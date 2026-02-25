/**
 * Deno FFI Binding Generator from C Headers
 *
 * CLI tool that generates Deno FFI bindings from C header files using libclang.
 */

import {
  type CXCursor,
  type CXTranslationUnit,
  type CXType,
  getCursorLocation,
  getCursorSpelling,
  getCursorType,
  getCursorUSR,
  getNumArgTypes,
  getPointeeType,
  getResultType,
  getTranslationUnitCursor,
  getTypeAlignment,
  getTypeKind,
  getTypeKindSpelling,
  getTypeSize,
  getTypeSpelling,
  getValueType,
  visitChildren,
} from "../libclang.ts";
import { CXChildVisitResult, CXCursorKind, CXTypeKind } from "./types.ts";

/**
 * Represents a field in a struct or union
 */
export interface StructField {
  /** The field name */
  name: string;
  /** The FFI type of the field */
  type: FFIType;
  /** Optional byte offset of the field */
  offset?: number;
  /** Whether this is a bitfield */
  isBitfield?: boolean;
  /** Width in bits if this is a bitfield */
  bitfieldWidth?: number;
}

/**
 * Information about a struct or union
 */
export interface StructInfo {
  /** The struct/union name */
  name: string;
  /** The USR (Unique Symbol Reference) */
  usr: string;
  /** Array of field definitions */
  fields: StructField[];
  /** Whether the struct is packed */
  isPacked: boolean;
  /** Whether this is a union (true) or struct (false) */
  isUnion: boolean;
  /** Size in bytes (null if unavailable) */
  size: number | null;
  /** Alignment in bytes (null if unavailable) */
  alignment: number | null;
  /** Source file location */
  location: {
    file: string | null;
    line: number;
    column: number;
    offset: number;
  } | null;
  /** Whether the struct is anonymous */
  isAnonymous: boolean;
  /** Number of fields */
  fieldCount: number;
}

/**
 * Information about a function
 */
export interface FunctionInfo {
  /** The function name */
  name: string;
  /** The return type */
  returnType: FFIType;
  /** Array of parameter definitions */
  parameters: { name: string; type: FFIType }[];
  /** Source file location */
  location: {
    file: string | null;
    line: number;
    column: number;
    offset: number;
  } | null;
}

/**
 * FFI type representation - either a primitive type or a struct type
 */
export type FFIType = string | { struct: string[] } | { namedStruct: string };

/**
 * Collected data from parsing a header file
 */
export interface CollectedData {
  /** Map of struct USR/name to struct information */
  structs: Map<string, StructInfo>;
  /** Array of function information */
  functions: FunctionInfo[];
}

/**
 * Options for FFI generation
 */
export interface FFIGeneratorOptions {
  /** Types that should be treated as handles (opaque pointers) */
  handleTypes: readonly string[];
  /** Primitive types that should be passed as buffers */
  bufferTypes: readonly string[];
  /** Custom type spelling to FFI type mappings */
  typeMappings?: Record<string, string>;
  /** Parameter names that should be treated as handles */
  handleParams?: readonly string[];
}

/**
 * Create default options for FFI generation
 *
 * @returns Default FFIGeneratorOptions with empty configurations
 */
export function createDefaultOptions(): FFIGeneratorOptions {
  return {
    handleTypes: [],
    bufferTypes: [],
    typeMappings: {},
    handleParams: [],
  };
}

function getTypeKindFromBuffer(buffer: Uint8Array): CXTypeKind {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  return view.getUint32(0, true) as CXTypeKind;
}

function lowerTypeToFFI(
  type: CXType | Uint8Array,
  options: FFIGeneratorOptions,
  structs: Map<string, StructInfo>,
  depth: number = 0,
  paramName?: string,
): FFIType {
  const { handleTypes, bufferTypes, typeMappings, handleParams } = options;

  if (depth > 10) {
    return "pointer"; // Prevent infinite recursion
  }

  const kind = type instanceof Uint8Array
    ? getTypeKindFromBuffer(type)
    : getTypeKind(type);

  switch (kind) {
    case CXTypeKind.Void:
      return "void";
    case CXTypeKind.Bool:
    case CXTypeKind.Char_U:
    case CXTypeKind.Char_S:
      return "u8";
    case CXTypeKind.SChar:
      return "i8";
    case CXTypeKind.UChar:
      return "u8";
    case CXTypeKind.Short:
      return "i16";
    case CXTypeKind.UShort:
      return "u16";
    case CXTypeKind.Int:
      return "i32";
    case CXTypeKind.UInt:
      return "u32";
    case CXTypeKind.Long:
      return is64BitPlatform() ? "i64" : "i32";
    case CXTypeKind.ULong:
      return is64BitPlatform() ? "u64" : "u32";
    case CXTypeKind.LongLong:
      return "i64";
    case CXTypeKind.ULongLong:
      return "u64";
    case CXTypeKind.Float:
      return "f32";
    case CXTypeKind.Double:
      return "f64";
    case CXTypeKind.Pointer: {
      const pointee = type instanceof Uint8Array
        ? getPointeeType(type)
        : getPointeeType(type);
      const pointeeKind = pointee instanceof Uint8Array
        ? getTypeKindFromBuffer(pointee)
        : getTypeKind(pointee);

      // For char* strings, use pointer
      if (pointeeKind === CXTypeKind.Char_S) {
        return "pointer";
      }

      // For void*, use pointer
      if (pointeeKind === CXTypeKind.Void) {
        return "pointer";
      }

      // Check the pointee type spelling for handle types
      const pointeeTypeSpelling = getTypeSpelling(pointee).toLowerCase();

      // Check if this is an output parameter by looking at the parameter name
      // Output params typically have names starting with "out" or containing "_out"
      // Input pointers (handles) should use "u64" to accept bigints directly
      if (paramName) {
        const lowerParamName = paramName.toLowerCase();
        // Only treat as output if it starts with "out" or has "_out" suffix
        // Don't treat "result" as output - it's commonly used for input handles
        if (
          lowerParamName.startsWith("out") || lowerParamName.includes("_out")
        ) {
          return "buffer";
        }
        // Check if this is a pointer to a handle type from config
        // These should use "buffer" since the function modifies them
        if (handleTypes.some((h) => pointeeTypeSpelling === h.toLowerCase())) {
          // It's a pointer to a handle - use buffer since function modifies it
          return "buffer";
        }
        // For simple input pointers (handles), use u64 to accept bigints directly
        return "u64";
      }

      // Check if this pointer type should be treated as a buffer
      const pointeeKindSpelling = getTypeKindSpelling(pointeeKind)
        .toLowerCase();
      if (bufferTypes.some((b) => pointeeKindSpelling === b.toLowerCase())) {
        return "buffer";
      }

      // For pointers without a parameter name (e.g., struct pointers), use "pointer"
      return "pointer";
    }
    case CXTypeKind.Record: {
      // Get struct name from type spelling (e.g., "struct Point", "union Foo")
      const typeSpelling = getTypeSpelling(type);
      // Return named struct info - still pass by reference but with type info
      return { namedStruct: typeSpelling };
    }
    case CXTypeKind.Auto: {
      // Auto types - try to resolve using getValueType or getTypeSpelling
      try {
        const valueType = getValueType(type);
        return lowerTypeToFFI(
          valueType,
          options,
          structs,
          depth + 1,
          paramName,
        );
      } catch {
        // Fallback to checking type spelling
        const typeSpelling = getTypeSpelling(type).toLowerCase();
        // Check if it's a handle type from config
        if (handleTypes.some((h) => typeSpelling === h.toLowerCase())) {
          return "u64";
        }
        return "pointer";
      }
    }
    case CXTypeKind.Typedef: {
      // For typedefs, try to resolve to the underlying type using getValueType
      try {
        const valueType = getValueType(type);
        return lowerTypeToFFI(
          valueType,
          options,
          structs,
          depth + 1,
          paramName,
        );
      } catch {
        // Fallback to checking known type names
        const typeSpelling = getTypeSpelling(type).toLowerCase();

        // Check custom type mappings first
        if (typeMappings && typeSpelling in typeMappings) {
          return typeMappings[typeSpelling];
        }

        // Handle types from config - use u64 to accept bigints directly
        if (handleTypes.some((h) => typeSpelling === h.toLowerCase())) {
          return "u64";
        }
        // For unknown typedefs, default to pointer
        return "pointer";
      }
    }
    case CXTypeKind.Elaborated: {
      // Get the underlying value type
      const valueType = type instanceof Uint8Array
        ? getPointeeType(type) // Elaborated types use pointer-like access
        : getPointeeType(type);
      return lowerTypeToFFI(
        valueType,
        options,
        structs,
        depth + 1,
        paramName,
      );
    }
    case CXTypeKind.Enum:
      return "i32"; // Enums are typically int
    case CXTypeKind.FunctionProto:
    case CXTypeKind.FunctionNoProto:
      return "pointer"; // Function pointers
    default: {
      // For unknown type kinds (new in LLVM 20), try to resolve by spelling
      const typeSpelling = getTypeSpelling(type).toLowerCase();

      // Check custom type mappings first
      if (typeMappings && typeSpelling in typeMappings) {
        return typeMappings[typeSpelling];
      }

      // Handle fixed-width integer types
      if (
        typeSpelling === "uint8_t" || typeSpelling === "uint8" ||
        typeSpelling === "unsigned char"
      ) {
        return "u8";
      }
      if (
        typeSpelling === "int8_t" || typeSpelling === "int8" ||
        typeSpelling === "signed char"
      ) {
        return "i8";
      }
      if (
        typeSpelling === "uint16_t" || typeSpelling === "uint16" ||
        typeSpelling === "unsigned short"
      ) {
        return "u16";
      }
      if (
        typeSpelling === "int16_t" || typeSpelling === "int16" ||
        typeSpelling === "short"
      ) {
        return "i16";
      }
      if (
        typeSpelling === "uint32_t" || typeSpelling === "uint32" ||
        typeSpelling === "unsigned int"
      ) {
        return "u32";
      }
      if (
        typeSpelling === "int32_t" || typeSpelling === "int32" ||
        typeSpelling === "int"
      ) {
        return "i32";
      }
      if (
        typeSpelling === "uint64_t" || typeSpelling === "uint64" ||
        typeSpelling === "unsigned long" ||
        typeSpelling === "unsigned long long" ||
        typeSpelling === "idx_t" || typeSpelling === "size_t"
      ) {
        return "u64";
      }
      if (
        typeSpelling === "int64_t" || typeSpelling === "int64" ||
        typeSpelling === "long" || typeSpelling === "long long"
      ) {
        return "i64";
      }
      if (typeSpelling === "float") {
        return "f32";
      }
      if (typeSpelling === "double") {
        return "f64";
      }
      if (typeSpelling === "bool" || typeSpelling === "_bool") {
        return "u8";
      }
      // For unknown types, default to pointer
      // Check handle params
      if (handleParams && paramName) {
        if (handleParams.includes(paramName)) {
          return "u64";
        }
      }
      return "pointer";
    }
  }
}

function is64BitPlatform(): boolean {
  // Check pointer size - 8 bytes means 64-bit
  // Deno.build.pointerSize is available in newer Deno versions
  // We can also check arch to determine pointer size
  const arch = Deno.build.arch;
  // x86_64, aarch64, arm64 are 64-bit architectures
  return arch === "x86_64" || arch === "aarch64" || arch === "arm64";
}

/**
 * Convert a C name to a TypeScript-safe identifier
 *
 * @param name - The C identifier name
 * @returns A TypeScript-safe identifier
 */
export function makeTSafeName(name: string): string {
  // Remove invalid characters and make safe for TS
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");
}

function getStructFields(
  cursor: CXCursor,
  structs: Map<string, StructInfo>,
  options: FFIGeneratorOptions,
): StructField[] {
  const fields: StructField[] = [];

  // Visit children and collect buffers
  const children = visitChildren(cursor, () => {
    return CXChildVisitResult.Continue;
  });

  // Process each field buffer
  for (const childBuffer of children) {
    const kind = getKindFromBuffer(childBuffer);
    if (kind === CXCursorKind.FieldDecl) {
      const childCursor = childBuffer as unknown as CXCursor;
      const fieldName = getCursorSpelling(childCursor);
      const fieldType = getCursorType(childCursor);
      const fieldFFI = lowerTypeToFFI(
        fieldType,
        options,
        structs,
      );

      fields.push({
        name: fieldName,
        type: fieldFFI,
      });
    }
  }

  return fields;
}

function getKindFromBuffer(buffer: Uint8Array): CXCursorKind {
  const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
  return view.getUint32(0, true) as CXCursorKind;
}

/**
 * Collect struct and function declarations from a translation unit
 *
 * @param tu - The translation unit to analyze
 * @param bufferTypes - Types that should be passed as buffers
 * @param handleTypes - Types that should be treated as handles
 * @param warnings - Array to collect warnings during parsing
 * @param typeMappings - Optional custom type mappings
 * @param handleParams - Optional parameter names treated as handles
 * @returns CollectedData containing structs and functions
 */
export function collectDeclarations(
  tu: CXTranslationUnit,
  bufferTypes: string[],
  handleTypes: string[],
  warnings: string[],
  typeMappings?: Record<string, string>,
  handleParams?: string[],
): CollectedData {
  const options: FFIGeneratorOptions = {
    handleTypes,
    bufferTypes,
    typeMappings,
    handleParams,
  };

  const data: CollectedData = {
    structs: new Map(),
    functions: [],
  };

  const cursor = getTranslationUnitCursor(tu);

  // Visit children and collect buffers
  const children = visitChildren(cursor, () => {
    return CXChildVisitResult.Continue;
  });

  // Process each child buffer
  for (const childBuffer of children) {
    const kind = getKindFromBuffer(childBuffer);
    const childCursor = childBuffer as unknown as CXCursor;

    if (kind === CXCursorKind.StructDecl) {
      const name = getCursorSpelling(childCursor);
      const usr = getCursorUSR(childCursor);

      if (name || usr) {
        const fields = getStructFields(
          childCursor,
          data.structs,
          options,
        );
        const key = usr || name;

        // Get the type for size/alignment info
        const structType = getCursorType(childCursor);
        let size: number | null = null;
        let alignment: number | null = null;
        try {
          const sizeResult = getTypeSize(structType);
          if (sizeResult >= 0) {
            size = Number(sizeResult);
          }
        } catch {
          // Size not available
        }
        try {
          const alignResult = getTypeAlignment(structType);
          if (alignResult >= 0) {
            alignment = Number(alignResult);
          }
        } catch {
          // Alignment not available
        }

        // Get source location
        let location: {
          file: string | null;
          line: number;
          column: number;
          offset: number;
        } | null = null;
        try {
          const loc = getCursorLocation(childCursor);
          location = {
            file: loc.file,
            line: loc.line,
            column: loc.column,
            offset: loc.offset,
          };
        } catch {
          // Location not available
        }

        // Check if anonymous (name is empty but we have a USR)
        const isAnonymous = !name && !!usr;

        data.structs.set(key, {
          name: name || `anon_${key.slice(0, 8)}`,
          usr,
          fields,
          isPacked: false,
          isUnion: false,
          size,
          alignment,
          location,
          isAnonymous,
          fieldCount: fields.length,
        });
      }
    } else if (kind === CXCursorKind.UnionDecl) {
      const name = getCursorSpelling(childCursor);
      const usr = getCursorUSR(childCursor);

      if (name || usr) {
        const fields = getStructFields(
          childCursor,
          data.structs,
          options,
        );
        const key = usr || name;

        warnings.push(`Union '${name || key}' detected - treating as bytes`);

        // Get the type for size/alignment info
        const unionType = getCursorType(childCursor);
        let size: number | null = null;
        let alignment: number | null = null;
        try {
          const sizeResult = getTypeSize(unionType);
          if (sizeResult >= 0) {
            size = Number(sizeResult);
          }
        } catch {
          // Size not available
        }
        try {
          const alignResult = getTypeAlignment(unionType);
          if (alignResult >= 0) {
            alignment = Number(alignResult);
          }
        } catch {
          // Alignment not available
        }

        // Get source location
        let location: {
          file: string | null;
          line: number;
          column: number;
          offset: number;
        } | null = null;
        try {
          const loc = getCursorLocation(childCursor);
          location = {
            file: loc.file,
            line: loc.line,
            column: loc.column,
            offset: loc.offset,
          };
        } catch {
          // Location not available
        }

        // Check if anonymous (name is empty but we have a USR)
        const isAnonymous = !name && !!usr;

        data.structs.set(key, {
          name: name || `anon_union_${key.slice(0, 8)}`,
          usr,
          fields,
          isPacked: false,
          isUnion: true,
          size,
          alignment,
          location,
          isAnonymous,
          fieldCount: fields.length,
        });
      }
    } else if (kind === CXCursorKind.FunctionDecl) {
      const funcName = getCursorSpelling(childCursor);
      const funcType = getCursorType(childCursor);

      // Skip duplicates early - before processing any parameters
      if (data.functions.some((f) => f.name === funcName)) {
        continue;
      }

      if (funcName && !funcName.startsWith("_")) {
        const returnType = getResultType(funcType);
        const returnFFI = lowerTypeToFFI(
          returnType,
          options,
          data.structs,
        );

        const _numArgs = getNumArgTypes(funcType);
        const parameters: { name: string; type: FFIType }[] = [];

        // Visit function parameters
        const paramChildren = visitChildren(childCursor, () => {
          return CXChildVisitResult.Continue;
        });

        // Process each parameter buffer
        for (const paramBuffer of paramChildren) {
          const paramKind = getKindFromBuffer(paramBuffer);
          const paramCursor = paramBuffer as unknown as CXCursor;
          if (paramKind === CXCursorKind.ParmDecl) {
            const paramName = getCursorSpelling(paramCursor) ||
              `arg${parameters.length}`;
            const paramType = getCursorType(paramCursor);
            const paramFFI = lowerTypeToFFI(
              paramType,
              options,
              data.structs,
              0,
              paramName,
            );
            parameters.push({ name: paramName, type: paramFFI });
          }
        }

        // Get function attributes
        let location: {
          file: string | null;
          line: number;
          column: number;
          offset: number;
        } | null = null;
        try {
          const loc = getCursorLocation(childCursor);
          location = {
            file: loc.file,
            line: loc.line,
            column: loc.column,
            offset: loc.offset,
          };
        } catch {
          // Location not available
        }

        data.functions.push({
          name: funcName,
          returnType: returnFFI,
          parameters,
          location,
        });
      }
    }
  }

  return data;
}

/**
 * Generate the output header for FFI bindings
 *
 * @param _data - The collected data (unused in this simple implementation)
 * @param headerPath - Path to the source header file
 * @param clangArgs - Arguments passed to Clang
 * @param warnings - Array of warnings to include
 * @returns Generated output as a string
 */
export function generateOutput(
  _data: CollectedData,
  headerPath: string,
  clangArgs: string[],
  warnings: string[],
): string {
  const lines: string[] = [];

  // Header
  lines.push("/**");
  lines.push(" * Auto-generated Deno FFI bindings");
  lines.push(` * Source: ${headerPath}`);
  lines.push(` * Generated: ${new Date().toISOString()}`);
  if (clangArgs.length > 0) {
    lines.push(` * Clang args: ${clangArgs.join(" ")}`);
  }
  lines.push(" *");
  lines.push(
    " * WARNING: These bindings are auto-generated and may be incomplete.",
  );
  lines.push(" * Review carefully before use in production.");
  lines.push(" */");
  lines.push("");

  // Warnings
  if (warnings.length > 0) {
    lines.push("// Warnings:");
    for (const warning of warnings) {
      lines.push(`//   - ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
