/**
 * Type functions
 */

import {
  type CXCursor,
  type CXType,
  CXTypeKind,
  type NativePointer,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";
import { cxStringToString, toNativeCursor, toNativeType } from "./helpers.ts";

/**
 * Parse CXType result from FFI call
 *
 * Deno FFI returns Uint8Array for struct returns - parse it manually.
 * This is a common pattern in type.ts functions.
 *
 * @param result - The result from FFI call (either Uint8Array or CXType)
 * @returns A parsed CXType object
 */
function parseCXTypeResult(result: Uint8Array | CXType): CXType {
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }
  return result;
}

/**
 * Convert CXType to a buffer for passing to FFI functions
 *
 * This is used when calling libclang functions that expect a CXType parameter,
 * as Deno FFI requires passing the struct as raw bytes when the function returns
 * a struct (which CXType does).
 *
 * @param type - The CXType to convert
 * @returns A Uint8Array buffer that can be passed to FFI functions
 */
export function cxTypeToBuffer(type: CXType): Uint8Array {
  const view = new DataView(new ArrayBuffer(24));
  view.setUint32(0, type.kind, true);
  view.setUint32(4, type.reserved, true);
  view.setBigUint64(8, type.data0 as unknown as bigint, true);
  view.setBigUint64(16, type.data1 as unknown as bigint, true);
  return new Uint8Array(view.buffer);
}

/**
 * Parse CXType from a buffer returned by FFI
 *
 * Deno FFI returns Uint8Array for struct returns - parse it manually.
 *
 * @param buffer - The Uint8Array buffer returned by FFI
 * @returns A parsed CXType object
 */
export function parseCXTypeFromBuffer(buffer: Uint8Array): CXType {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  // CXType: { kind: u32, reserved: u32, data0: pointer, data1: pointer }
  const kind = view.getUint32(0, true);
  const reserved = view.getUint32(4, true);
  const data0 = view.getBigUint64(8, true);
  const data1 = view.getBigUint64(16, true);

  return {
    kind,
    reserved,
    data0: data0 as unknown as NativePointer,
    data1: data1 as unknown as NativePointer,
  };
}

/**
 * Get the type of a cursor
 *
 * @param cursor - CXCursor (from TU) or Uint8Array buffer (from visitChildren)
 * @returns CXType
 */
export function getCursorType(cursor: CXCursor | Uint8Array): CXType {
  const sym = getSymbols();
  const result = sym.clang_getCursorType(toNativeCursor(cursor));
  return parseCXTypeResult(result);
}

/**
 * Get the underlying type of a typedef declaration
 *
 * For typedefs like `typedef int my_int;`, this returns the underlying type (int)
 *
 * @param cursor - CXCursor for a typedef declaration, or Uint8Array buffer
 * @returns CXType of the underlying type
 */
export function getTypedefUnderlyingType(
  cursor: CXCursor | Uint8Array,
): CXType {
  const sym = getSymbols();
  const result = sym.clang_getTypedefDeclUnderlyingType(toNativeCursor(cursor));
  return parseCXTypeResult(result);
}

/**
 * Get the value type from an elaborated type
 *
 * For types like `int8_t` that are elaborated, this returns the underlying type
 *
 * @param type - CXType that may be elaborated
 * @returns CXType of the value type
 */
export function getValueType(type: CXType | Uint8Array): CXType {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_Type_getValueType(typeArg as unknown as CXType);
  return parseCXTypeResult(result);
}

/**
 * Get the kind of a type
 *
 * In LLVM 20+, the kind is directly accessible from the CXType struct.
 *
 * @param type - The CXType to get the kind from
 * @returns The CXTypeKind value identifying the type
 */
export function getTypeKind(type: CXType): CXTypeKind {
  // In LLVM 20+, clang_getTypeKind was removed and kind is now the first field of CXType
  return type.kind as CXTypeKind;
}

/**
 * Get the spelling (string representation) of a type
 *
 * @param type - CXType or Uint8Array buffer
 * @returns The type spelling string (e.g., "int", "const char*")
 */
export function getTypeSpelling(type: CXType | Uint8Array): string {
  const sym = getSymbols();
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const cxString = sym.clang_getTypeSpelling(typeBuffer as unknown as CXType);
  return cxStringToString(cxString);
}

/**
 * Get the number of function parameters
 *
 * @param type - CXType of a function
 * @returns number of parameters, or -1 if not a function type
 */
export function getNumArgTypes(type: CXType | Uint8Array): number {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  return sym.clang_getNumArgTypes(toNativeType(typeArg));
}

/**
 * Get the type of a function parameter
 *
 * @param type - CXType of a function
 * @param argIndex - index of the argument (0-based)
 * @returns CXType of the argument
 */
export function getArgType(
  type: CXType | Uint8Array,
  argIndex: number,
): CXType {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_getArgType(
    toNativeType(typeArg),
    argIndex,
  );
  return parseCXTypeResult(result);
}

/**
 * Get the result type of a function type
 *
 * For function types, this returns the return type
 *
 * @param type - CXType of a function
 * @returns CXType of the result (return type)
 */
export function getResultType(type: CXType | Uint8Array): CXType {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_getResultType(toNativeType(typeArg));
  return parseCXTypeResult(result);
}

/**
 * Get the pointee type of a pointer type
 *
 * For pointer types, this returns the type being pointed to
 *
 * @param type - CXType of a pointer
 * @returns CXType of the pointee
 */
export function getPointeeType(type: CXType | Uint8Array): CXType {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_getPointeeType(toNativeType(typeArg));
  return parseCXTypeResult(result);
}

/**
 * Get the spelling (name) of a type kind
 *
 * @param kind - The CXTypeKind to get the spelling for
 * @returns The string name of the type kind (e.g., "Int", "Pointer", "Struct")
 */
export function getTypeKindSpelling(kind: CXTypeKind): string {
  const sym = getSymbols();
  const cxString = sym.clang_getTypeKindSpelling(kind as number);
  return cxStringToString(cxString);
}

/**
 * Get the size of a type in bytes
 *
 * @param type - CXType or Uint8Array buffer
 * @returns The size in bytes, or -1 if size is not available
 */
export function getTypeSize(type: CXType | Uint8Array): number {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  return sym.clang_Type_getSizeOf(toNativeType(typeArg));
}

/**
 * Get the alignment of a type in bytes
 *
 * @param type - CXType or Uint8Array buffer
 * @returns The alignment in bytes, or -1 if alignment is not available
 */
export function getTypeAlignment(type: CXType | Uint8Array): number {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  return sym.clang_Type_getAlignOf(toNativeType(typeArg));
}

/**
 * Check if a type has the const qualifier
 *
 * Uses spelling-based detection since clang_Type_isConst is not available
 * in all LLVM versions (removed in LLVM 20).
 *
 * @param type - CXType or Uint8Array buffer
 * @returns true if the type has the const qualifier, false otherwise
 */
export function isConstType(type: CXType | Uint8Array): boolean {
  // Use spelling-based detection
  const spelling = getTypeSpelling(type);
  return spelling.toLowerCase().includes("const");
}

/**
 * NativeType allowed in Deno FFI structs
 */
export type NativeType =
  | "i8"
  | "u8"
  | "i16"
  | "u16"
  | "i32"
  | "u32"
  | "i64"
  | "u64"
  | "f32"
  | "f64"
  | "pointer"
  | "buffer";

/**
 * Check if a type spelling represents a char pointer type
 *
 * This handles: char*, const char*, char**, const char**, etc.
 *
 * @param typeSpelling - The type spelling string (e.g., "const char*", "char**")
 * @returns true if the type is a char pointer type
 */
export function isCharPointerType(typeSpelling: string): boolean {
  const spelling = typeSpelling.toLowerCase();
  // Remove const/volatile prefixes for checking
  const cleanSpelling = spelling.replace(/^(const |volatile )/, "").trim();
  // Check for char* or char** patterns
  return cleanSpelling.includes("char") && cleanSpelling.includes("*");
}

/**
 * Check if a type spelling represents a void pointer type
 *
 * This handles: void*, const void*, void**, etc.
 *
 * @param typeSpelling - The type spelling string
 * @returns true if the type is a void pointer type
 */
export function isVoidPointerType(typeSpelling: string): boolean {
  const spelling = typeSpelling.toLowerCase();
  // Remove const/volatile prefixes for checking
  const cleanSpelling = spelling.replace(/^(const |volatile )/, "").trim();
  return cleanSpelling === "void" ||
    (cleanSpelling.includes("void") && cleanSpelling.includes("*"));
}

/**
 * Get the pointer depth of a type (number of * in the type)
 *
 * @param typeSpelling - The type spelling string (e.g., "char", "char*", "char**")
 * @returns The pointer depth (0 for non-pointer, 1 for single pointer, etc.)
 */
export function getPointerDepth(typeSpelling: string): number {
  const cleanSpelling = typeSpelling.replace(/^(const |volatile )/, "").trim();
  // Count asterisks that are not part of comments or multiplication
  const stars = cleanSpelling.match(/\*/g);
  return stars ? stars.length : 0;
}

/**
 * Map CXTypeKind to Deno FFI type string
 *
 * @param typeKind - The CXTypeKind to convert
 * @param typeSpelling - The type spelling string (used for elaborated types)
 * @returns The Deno FFI type string, or null if conversion is not possible
 */
export function typeKindToFFI(
  typeKind: CXTypeKind,
  typeSpelling: string,
): string | null {
  switch (typeKind) {
    case CXTypeKind.Void:
      return "void";
    case CXTypeKind.Bool:
    case CXTypeKind.Char_U:
    case CXTypeKind.Char_S:
      return "u8";
    case CXTypeKind.SChar:
      // Check spelling for unsigned variants (libclang sometimes misreports uint8_t as SChar)
      if (typeSpelling.toLowerCase().includes("uint8")) return "u8";
      return "i8";
    case CXTypeKind.UChar:
      return "u8";
    case CXTypeKind.Short:
      // Check spelling for unsigned variants (libclang sometimes misreports uint16_t as Short)
      if (typeSpelling.toLowerCase().includes("uint16")) return "u16";
      return "i16";
    case CXTypeKind.UShort:
      return "u16";
    case CXTypeKind.Int:
      // Check spelling for unsigned variants (libclang sometimes misreports uint32_t as Int)
      if (typeSpelling.toLowerCase().includes("uint32")) return "u32";
      return "i32";
    case CXTypeKind.UInt:
      return "u32";
    case CXTypeKind.Long:
      // Use pointer size - 64-bit: i64, 32-bit: i32
      return Deno.build.arch === "x86_64" || Deno.build.arch === "aarch64"
        ? "i64"
        : "i32";
    case CXTypeKind.ULong:
      return Deno.build.arch === "x86_64" || Deno.build.arch === "aarch64"
        ? "u64"
        : "u32";
    case CXTypeKind.LongLong:
      return "i64";
    case CXTypeKind.ULongLong:
      return "u64";
    case CXTypeKind.Float:
      return "f32";
    case CXTypeKind.Double:
      return "f64";
    case CXTypeKind.Pointer:
      return "pointer";
    case CXTypeKind.Enum:
      return "i32";
    case CXTypeKind.Record:
      return "pointer";
    case CXTypeKind.Elaborated: {
      // Elaborated types - need to resolve to underlying type
      // For now, try to infer from spelling
      const spelling = typeSpelling.toLowerCase();
      if (spelling.includes("int8") || spelling.includes("int8_t")) return "i8";
      if (spelling.includes("uint8") || spelling.includes("uint8_t")) {
        return "u8";
      }
      if (spelling.includes("int16") || spelling.includes("int16_t")) {
        return "i16";
      }
      if (spelling.includes("uint16") || spelling.includes("uint16_t")) {
        return "u16";
      }
      // Check unsigned before signed to avoid substring match issues
      if (spelling.includes("uint64") || spelling.includes("uint64_t")) {
        return "u64";
      }
      if (spelling.includes("int64") || spelling.includes("int64_t")) {
        return "i64";
      }
      if (spelling.includes("uint32") || spelling.includes("uint32_t")) {
        return "u32";
      }
      if (spelling.includes("int32") || spelling.includes("int32_t")) {
        return "i32";
      }
      if (spelling.includes("float")) return "f32";
      if (spelling.includes("double")) return "f64";
      if (spelling.includes("bool")) return "u8";
      if (spelling.includes("char") && spelling.includes("*")) return "pointer";
      if (spelling.includes("void") && spelling.includes("*")) return "pointer";
      // Check for struct/union types
      if (spelling.startsWith("struct ") || spelling.startsWith("union ")) {
        return "pointer";
      }
      return null;
    }
    default: {
      // Try to infer from spelling
      const spelling = typeSpelling.toLowerCase();
      if (spelling.includes("int8") || spelling.includes("int8_t")) return "i8";
      if (spelling.includes("uint8") || spelling.includes("uint8_t")) {
        return "u8";
      }
      if (spelling.includes("int16") || spelling.includes("int16_t")) {
        return "i16";
      }
      if (spelling.includes("uint16") || spelling.includes("uint16_t")) {
        return "u16";
      }
      // Check unsigned before signed to avoid substring match issues
      if (spelling.includes("uint64") || spelling.includes("uint64_t")) {
        return "u64";
      }
      if (spelling.includes("int64") || spelling.includes("int64_t")) {
        return "i64";
      }
      if (spelling.includes("uint32") || spelling.includes("uint32_t")) {
        return "u32";
      }
      if (spelling.includes("int32") || spelling.includes("int32_t")) {
        return "i32";
      }
      if (spelling === "float") return "f32";
      if (spelling === "double") return "f64";
      if (spelling === "bool") return "u8";
      return null;
    }
  }
}
