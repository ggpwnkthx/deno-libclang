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
import { CX_TYPE_SIZE, POINTER_SIZE, readPtr, writePtr } from "../utils/ffi.ts";

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
  const view = new DataView(new ArrayBuffer(CX_TYPE_SIZE));
  view.setUint32(0, type.kind, true);
  view.setUint32(4, type.reserved, true);
  // Treat data0 and data1 as opaque integral slots (bigint), not pointer objects
  writePtr(view, 8, type.data0 as unknown as bigint);
  writePtr(view, 8 + POINTER_SIZE, type.data1 as unknown as bigint);
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
  const data0 = readPtr(view, 8);
  const data1 = readPtr(view, 8 + POINTER_SIZE);

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
 * Get the value type from an atomic type
 *
 * For atomic types (C11 _Atomic), this returns the underlying value type.
 * Note: This is NOT for unwrapping elaborated types - use getNamedType() for that.
 *
 * @param type - CXType that may be an atomic type
 * @returns CXType of the value type, or an invalid type if not atomic
 */
export function getAtomicValueType(type: CXType | Uint8Array): CXType {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_Type_getValueType(typeArg as unknown as CXType);
  return parseCXTypeResult(result);
}

/**
 * Get the named type from an elaborated type
 *
 * For elaborated types (e.g., "struct Foo", "class Bar"), this returns the
 * named underlying type.
 *
 * @param type - CXType that may be an elaborated type
 * @returns CXType of the named type
 */
export function getNamedType(type: CXType | Uint8Array): CXType {
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_Type_getNamedType(typeArg as unknown as CXType);
  return parseCXTypeResult(result);
}

/**
 * Get the value type from an elaborated type (legacy alias)
 *
 * @deprecated Use getAtomicValueType() for atomic types or getNamedType() for
 *             elaborated types. This function now delegates to getAtomicValueType.
 * @param type - CXType that may be elaborated
 * @returns CXType of the value type
 */
export function getValueType(type: CXType | Uint8Array): CXType {
  // getValueType was incorrectly documented as unwrapping elaborated types
  // but actually only works for atomic types. Delegate to atomic version.
  return getAtomicValueType(type);
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
 * Tries to use clang_isConstQualifiedType if available (LLVM 15+),
 * falls back to spelling-based detection otherwise.
 *
 * @param type - CXType or Uint8Array buffer
 * @returns true if the type has the const qualifier, false otherwise
 */
export function isConstType(type: CXType | Uint8Array): boolean {
  const sym = getSymbols();
  // Try to use clang_isConstQualifiedType if available
  if (sym.clang_isConstQualifiedType) {
    const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
    const result = sym.clang_isConstQualifiedType(
      typeBuffer as unknown as CXType,
    );
    return result !== 0;
  }
  // Fall back to spelling-based detection
  const spelling = getTypeSpelling(type);
  // Match "const" as a word boundary, not as part of another word
  return /\bconst\b/.test(spelling);
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
 * Does NOT match: wchar_t*, char16_t*, char32_t*
 *
 * @param typeSpelling - The type spelling string (e.g., "const char*", "char**")
 * @returns true if the type is a char pointer type
 */
export function isCharPointerType(typeSpelling: string): boolean {
  const spelling = typeSpelling.toLowerCase();
  // Remove const/volatile prefixes for checking
  const cleanSpelling = spelling.replace(/^(const |volatile )/, "").trim();
  // Exclude wchar_t, char16_t, char32_t
  if (
    cleanSpelling.includes("char16") ||
    cleanSpelling.includes("char32") ||
    cleanSpelling.includes("wchar")
  ) {
    return false;
  }
  // Match only plain "char*" not "wchar_t*" or "char16_t*"
  // Use anchored regex to match only char at start or preceded by non-word char
  return /(^|[^a-z])char(\*)+/.test(cleanSpelling) ||
    (cleanSpelling.includes("char") && cleanSpelling.includes("*"));
}

/**
 * Check if a type spelling represents a void pointer type
 *
 * This handles: void*, const void*, void**, etc.
 * Does NOT match: plain "void" (not a pointer)
 *
 * @param typeSpelling - The type spelling string
 * @returns true if the type is a void pointer type
 */
export function isVoidPointerType(typeSpelling: string): boolean {
  const spelling = typeSpelling.toLowerCase();
  // Remove const/volatile prefixes for checking
  const cleanSpelling = spelling.replace(/^(const |volatile )/, "").trim();
  // Must have at least one pointer asterisk - void by itself is not a pointer
  return cleanSpelling === "void*" ||
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
      return "u8";
    case CXTypeKind.Char_S:
      // On Windows, char is unsigned (u8). On Unix, it's signed (i8).
      // Document platform dependence.
      return Deno.build.os === "windows" ? "u8" : "i8";
    case CXTypeKind.Char_U:
      return "u8"; // unsigned char always u8
    case CXTypeKind.SChar:
      // Check spelling for unsigned variants (libclang sometimes misreports uint8_t as SChar)
      if (/\buint8(_t)?\b/.test(typeSpelling.toLowerCase())) return "u8";
      return "i8";
    case CXTypeKind.UChar:
      return "u8";
    case CXTypeKind.Short:
      // Check spelling for unsigned variants (libclang sometimes misreports uint16_t as Short)
      if (/\buint16(_t)?\b/.test(typeSpelling.toLowerCase())) return "u16";
      return "i16";
    case CXTypeKind.UShort:
      return "u16";
    case CXTypeKind.Int:
      // Check spelling for unsigned variants (libclang sometimes misreports uint32_t as Int)
      if (/\buint32(_t)?\b/.test(typeSpelling.toLowerCase())) return "u32";
      return "i32";
    case CXTypeKind.UInt:
      return "u32";
    case CXTypeKind.Long:
      // Windows LLP64: long is always 32-bit even on x86_64
      if (Deno.build.os === "windows") return "i32";
      return Deno.build.arch === "x86_64" || Deno.build.arch === "aarch64"
        ? "i64"
        : "i32";
    case CXTypeKind.ULong:
      // Windows LLP64: unsigned long is always 32-bit even on x86_64
      if (Deno.build.os === "windows") return "u32";
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
      // Check unsigned before signed to avoid substring match issues (e.g., "uint8_t" contains "int8")
      // Use word boundary matching to avoid matching "uint16_t" as "int16"
      if (/\buint8(_t)?\b/.test(spelling)) {
        return "u8";
      }
      if (/\bint8(_t)?\b/.test(spelling)) return "i8";
      if (/\buint16(_t)?\b/.test(spelling)) {
        return "u16";
      }
      if (/\bint16(_t)?\b/.test(spelling)) {
        return "i16";
      }
      // Check unsigned before signed to avoid substring match issues
      if (/\buint64(_t)?\b/.test(spelling)) {
        return "u64";
      }
      if (/\bint64(_t)?\b/.test(spelling)) {
        return "i64";
      }
      if (/\buint32(_t)?\b/.test(spelling)) {
        return "u32";
      }
      if (/\bint32(_t)?\b/.test(spelling)) {
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
      // Try to infer from spelling - use word boundary matching to avoid substring bugs
      const spelling = typeSpelling.toLowerCase();
      // Check unsigned before signed to avoid substring match issues (e.g., "uint8_t" contains "int8")
      if (/\buint8(_t)?\b/.test(spelling)) {
        return "u8";
      }
      if (/\bint8(_t)?\b/.test(spelling)) return "i8";
      if (/\buint16(_t)?\b/.test(spelling)) {
        return "u16";
      }
      if (/\bint16(_t)?\b/.test(spelling)) {
        return "i16";
      }
      // Check unsigned before signed to avoid substring match issues
      if (/\buint64(_t)?\b/.test(spelling)) {
        return "u64";
      }
      if (/\bint64(_t)?\b/.test(spelling)) {
        return "i64";
      }
      if (/\buint32(_t)?\b/.test(spelling)) {
        return "u32";
      }
      if (/\bint32(_t)?\b/.test(spelling)) {
        return "i32";
      }
      if (spelling === "float") return "f32";
      if (spelling === "double") return "f64";
      if (spelling === "bool") return "u8";
      return null;
    }
  }
}
