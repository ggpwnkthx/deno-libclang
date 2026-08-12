/**
 * Type functions
 */

import { type CXCursor, type CXType, CXTypeKind } from "../ffi/types.ts";
import { getSymbols } from "./library.ts";
import { cxStringToString, toNativeCursor, toNativeType } from "./helpers.ts";
import {
  bigintToPtrValue,
  CX_TYPE_DATA0_OFFSET,
  CX_TYPE_DATA1_OFFSET,
  CX_TYPE_KIND_OFFSET,
  CX_TYPE_RESERVED_OFFSET,
  CX_TYPE_SIZE,
  ptrValueToBigint,
  readPtr,
  writePtr,
} from "../utils/ffi.ts";

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
  view.setUint32(CX_TYPE_KIND_OFFSET, type.kind, true);
  view.setUint32(CX_TYPE_RESERVED_OFFSET, type.reserved, true);
  // Treat data0 and data1 as opaque integral slots (bigint), not pointer objects
  writePtr(view, CX_TYPE_DATA0_OFFSET, ptrValueToBigint(type.data0));
  writePtr(view, CX_TYPE_DATA1_OFFSET, ptrValueToBigint(type.data1));
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
  const kind = view.getUint32(CX_TYPE_KIND_OFFSET, true);
  const reserved = view.getUint32(CX_TYPE_RESERVED_OFFSET, true);
  const data0 = readPtr(view, CX_TYPE_DATA0_OFFSET);
  const data1 = readPtr(view, CX_TYPE_DATA1_OFFSET);

  return {
    kind,
    reserved,
    data0: bigintToPtrValue(data0),
    data1: bigintToPtrValue(data1),
  };
}

/**
 * Get the type of a cursor
 *
 * @param cursor - CXCursor (from TU) or Uint8Array buffer (from visitChildren)
 * @returns CXType
 */
export function getCursorType(cursor: CXCursor | Uint8Array): CXType {
  if (cursor == null) {
    throw new Error("cursor cannot be null or undefined");
  }
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
  if (cursor == null) {
    throw new Error("cursor cannot be null or undefined");
  }
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
  if (type == null) {
    throw new Error("type cannot be null or undefined");
  }
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
  if (type == null) {
    throw new Error("type cannot be null or undefined");
  }
  const sym = getSymbols();
  const typeArg = type instanceof Uint8Array ? type : cxTypeToBuffer(type);
  const result = sym.clang_Type_getNamedType(typeArg as unknown as CXType);
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
      return Deno.build.os === "windows" ? "u8" : "i8";
    case CXTypeKind.Char_U:
      return "u8"; // unsigned char always u8
    case CXTypeKind.SChar:
      return inferSignedFromSpelling(typeSpelling, "i8", "u8");
    case CXTypeKind.UChar:
      return "u8";
    case CXTypeKind.Short:
      return inferSignedFromSpelling(typeSpelling, "i16", "u16");
    case CXTypeKind.UShort:
      return "u16";
    case CXTypeKind.Int:
      return inferSignedFromSpelling(typeSpelling, "i32", "u32");
    case CXTypeKind.UInt:
      return "u32";
    case CXTypeKind.Long:
      return mapLongType(true);
    case CXTypeKind.ULong:
      return mapLongType(false);
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
    case CXTypeKind.Elaborated:
      return inferFromElaboratedSpelling(typeSpelling);
    default:
      return inferFromSpelling(typeSpelling);
  }
}

/**
 * Infer signed vs unsigned based on type spelling
 */
function inferSignedFromSpelling(
  spelling: string,
  signed: string,
  unsigned: string,
): string {
  const lower = spelling.toLowerCase();
  const baseType = signed.slice(1); // "i8" -> "8", "i16" -> "16", etc.
  const unsignedPattern = new RegExp(`^u?int${baseType}(_t)?$`);
  if (unsignedPattern.test(lower)) {
    return unsigned;
  }
  return signed;
}

/**
 * Map long types accounting for platform differences
 * Windows LLP64: long is always 32-bit even on x86_64
 */
function mapLongType(isSigned: boolean): string {
  if (Deno.build.os === "windows") {
    return isSigned ? "i32" : "u32";
  }
  if (Deno.build.arch === "x86_64" || Deno.build.arch === "aarch64") {
    return isSigned ? "i64" : "u64";
  }
  return isSigned ? "i32" : "u32";
}

/**
 * Infer FFI type from elaborated type spelling
 */
function inferFromElaboratedSpelling(spelling: string): string | null {
  const lower = spelling.toLowerCase();
  // Check for fixed-width integers (unsigned before signed to avoid substring issues)
  if (/\buint8(_t)?\b/.test(lower)) return "u8";
  if (/\bint8(_t)?\b/.test(lower)) return "i8";
  if (/\buint16(_t)?\b/.test(lower)) return "u16";
  if (/\bint16(_t)?\b/.test(lower)) return "i16";
  if (/\buint64(_t)?\b/.test(lower)) return "u64";
  if (/\bint64(_t)?\b/.test(lower)) return "i64";
  if (/\buint32(_t)?\b/.test(lower)) return "u32";
  if (/\bint32(_t)?\b/.test(lower)) return "i32";
  // Check floating point
  if (lower.includes("float")) return "f32";
  if (lower.includes("double")) return "f64";
  if (lower.includes("bool")) return "u8";
  // Check pointer types
  if (lower.includes("char") && lower.includes("*")) return "pointer";
  if (lower.includes("void") && lower.includes("*")) return "pointer";
  // Check for struct/union types
  if (lower.startsWith("struct ") || lower.startsWith("union ")) {
    return "pointer";
  }
  return null;
}

/**
 * Infer FFI type from generic spelling (fallback for unknown type kinds)
 */
function inferFromSpelling(spelling: string): string | null {
  const lower = spelling.toLowerCase();
  // Check for fixed-width integers (unsigned before signed to avoid substring issues)
  if (/\buint8(_t)?\b/.test(lower)) return "u8";
  if (/\bint8(_t)?\b/.test(lower)) return "i8";
  if (/\buint16(_t)?\b/.test(lower)) return "u16";
  if (/\bint16(_t)?\b/.test(lower)) return "i16";
  if (/\buint64(_t)?\b/.test(lower)) return "u64";
  if (/\bint64(_t)?\b/.test(lower)) return "i64";
  if (/\buint32(_t)?\b/.test(lower)) return "u32";
  if (/\bint32(_t)?\b/.test(lower)) return "i32";
  // Check exact matches for basic types
  if (lower === "float") return "f32";
  if (lower === "double") return "f64";
  if (lower === "bool") return "u8";
  return null;
}
