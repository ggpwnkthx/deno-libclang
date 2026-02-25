/**
 * Type functions
 */

import type {
  CXCursor,
  CXType,
  CXTypeKind,
  NativePointer,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";

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

  // If cursor is already a Uint8Array buffer (from visitChildren), use it directly
  const cursorArg = cursor instanceof Uint8Array
    ? cursor as unknown as CXCursor
    : cursor;

  const result = sym.clang_getCursorType(cursorArg);

  // Deno FFI returns Uint8Array for struct returns - parse it manually
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }

  return result;
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

  // If cursor is already a Uint8Array buffer (from visitChildren), use it directly
  const cursorArg = cursor instanceof Uint8Array
    ? cursor as unknown as CXCursor
    : cursor;

  const result = sym.clang_getTypedefDeclUnderlyingType(cursorArg);

  // Deno FFI returns Uint8Array for struct returns - parse it manually
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }

  return result;
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

  // Convert CXType to buffer if needed
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);

  const result = sym.clang_Type_getValueType(typeBuffer as unknown as CXType);

  // Deno FFI returns Uint8Array for struct returns - parse it manually
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }

  return result;
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

  // Convert CXType to buffer if needed
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);

  const cxString = sym.clang_getTypeSpelling(typeBuffer as unknown as CXType);
  const cStr = sym.clang_getCString(cxString);
  const result = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  sym.clang_disposeString(cxString);
  return result;
}

/**
 * Get the number of function parameters
 *
 * @param type - CXType of a function
 * @returns number of parameters, or -1 if not a function type
 */
export function getNumArgTypes(type: CXType | Uint8Array): number {
  const sym = getSymbols();

  // Convert CXType to buffer if needed
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);

  return sym.clang_getNumArgTypes(typeBuffer as unknown as CXType);
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

  // Convert CXType to buffer if needed
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);

  const result = sym.clang_getArgType(
    typeBuffer as unknown as CXType,
    argIndex,
  );

  // Parse CXType from result
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }

  return result;
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

  // Convert CXType to buffer if needed
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);

  const result = sym.clang_getResultType(typeBuffer as unknown as CXType);

  // Deno FFI returns Uint8Array for struct returns - parse it manually
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }

  return result;
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

  // Convert CXType to buffer if needed
  const typeBuffer = type instanceof Uint8Array ? type : cxTypeToBuffer(type);

  const result = sym.clang_getPointeeType(typeBuffer as unknown as CXType);

  // Deno FFI returns Uint8Array for struct returns - parse it manually
  if (result instanceof Uint8Array) {
    return parseCXTypeFromBuffer(result);
  }

  return result;
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
  const cStr = sym.clang_getCString(cxString);
  const result = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  sym.clang_disposeString(cxString);
  return result;
}
