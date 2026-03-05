/**
 * Shared FFI utilities
 *
 * Provides common FFI operations used across multiple modules.
 */

// Determine pointer size based on platform
export const POINTER_SIZE = Deno.build.arch === "x86_64" ||
    Deno.build.arch === "aarch64"
  ? 8
  : 4;

// ULONG_SIZE: On Windows LLP64, unsigned long is always 32-bit
// On Unix, it's 32-bit on 32-bit systems, 64-bit on 64-bit systems
export const ULONG_SIZE = Deno.build.os === "windows"
  ? 4
  : Deno.build.arch === "x86_64" || Deno.build.arch === "aarch64"
  ? 8
  : 4;

// CXCursor size: kind:u32 + xdata:i32 + 3 pointers
export const CX_CURSOR_SIZE = 8 + POINTER_SIZE * 3;

// CXCursor field offsets
export const CX_CURSOR_KIND_OFFSET = 0;
export const CX_CURSOR_XDATA_OFFSET = 4;
export const CX_CURSOR_DATA0_OFFSET = 8;
export const CX_CURSOR_DATA1_OFFSET = 8 + POINTER_SIZE;
export const CX_CURSOR_DATA2_OFFSET = 8 + POINTER_SIZE * 2;

// CXType size: kind:u32 + reserved:u32 + 2 pointers
export const CX_TYPE_SIZE = 8 + POINTER_SIZE * 2;

// CXType field offsets
export const CX_TYPE_KIND_OFFSET = 0;
export const CX_TYPE_RESERVED_OFFSET = 4;
export const CX_TYPE_DATA0_OFFSET = 8;
export const CX_TYPE_DATA1_OFFSET = 8 + POINTER_SIZE;

// CXSourceLocation: 2 pointers + u32
export const CX_SOURCE_LOCATION_SIZE = POINTER_SIZE * 2 + 4;

// CXSourceRange: 2 pointers + 2 u32s
export const CX_SOURCE_RANGE_SIZE = POINTER_SIZE * 2 + 8;

// Little-endian guard - throw on big-endian systems
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
  throw new Error("Big-endian systems not supported");
}

// Reusable TextEncoder instance (stateless and safe to reuse)
const encoder = new TextEncoder();

/**
 * Create a pointer buffer for passing/receiving pointers
 *
 * @param size - The size of the buffer in bytes (default: 8 for pointer size)
 * @returns A Uint8Array buffer of the specified size
 */
export function createPointerBuffer(size: number = POINTER_SIZE): Uint8Array {
  return new Uint8Array(size);
}

/**
 * Extract a pointer from a buffer
 *
 * @param buffer - The buffer containing the pointer data
 * @returns The pointer value as a bigint
 */
export function getPointer(buffer: Uint8Array): bigint {
  return readPtrFromBuffer(buffer, 0);
}

/**
 * Set a pointer in a buffer
 *
 * @param buffer - The buffer to write the pointer to
 * @param ptr - The pointer value to set
 */
export function setPointer(buffer: Uint8Array, ptr: bigint): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset, POINTER_SIZE);
  writePtr(view, 0, ptr);
}

/**
 * Read a pointer from DataView at given offset (pointer-size aware)
 */
export function readPtr(view: DataView, offset: number): bigint {
  if (POINTER_SIZE === 8) {
    return view.getBigUint64(offset, true);
  } else {
    return BigInt(view.getUint32(offset, true));
  }
}

/**
 * Write a pointer to DataView at given offset (pointer-size aware)
 */
export function writePtr(view: DataView, offset: number, value: bigint): void {
  if (POINTER_SIZE === 8) {
    view.setBigUint64(offset, value, true);
  } else {
    view.setUint32(offset, Number(value), true);
  }
}

/**
 * Read a pointer from a Uint8Array buffer
 */
export function readPtrFromBuffer(buf: Uint8Array, offset: number = 0): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, POINTER_SIZE);
  return readPtr(view, 0);
}

/**
 * Convert a bigint address to Deno.PointerValue
 * 0n -> null, otherwise -> UnsafePointer
 */
export function bigintToPtrValue(addr: bigint): Deno.PointerValue | null {
  if (addr === 0n) {
    return null;
  }
  return Deno.UnsafePointer.create(addr);
}

/**
 * Convert a C string pointer to a JavaScript string
 *
 * @param ptr - The pointer to the C string
 * @returns The JavaScript string representation
 */
export function ptrToCString(ptr: Deno.PointerValue): string {
  if (!ptr) return "";
  return new Deno.UnsafePointerView(ptr).getCString();
}

/**
 * Safely convert a value to a NativePointer
 *
 * This helper handles nullable pointers and other edge cases safely,
 * avoiding the need for unsafe type assertions.
 *
 * @param value - The value to convert (can be null, undefined, pointer, or buffer)
 * @returns A NativePointer or null
 */
export function toNativePointer(
  value: Deno.PointerValue | null | undefined | Uint8Array,
): Deno.PointerValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Uint8Array) {
    // Use type assertion to handle the ArrayBuffer type mismatch
    return Deno.UnsafePointer.of(value as Uint8Array<ArrayBuffer>);
  }

  // If it's already a valid pointer value, return it
  return value as Deno.PointerValue;
}

/**
 * Safely check if a pointer is non-null
 *
 * @param ptr - The pointer to check
 * @returns true if the pointer is non-null
 */
export function isValidPointer(ptr: Deno.PointerValue | null): boolean {
  return ptr !== null && ptr !== undefined;
}

/**
 * Result from cstringToPtr - includes pointer and buffer to keep alive
 */
export interface CStringResult {
  ptr: Deno.PointerValue;
  keepAlive: Uint8Array;
}

/**
 * Convert a JavaScript string to a C string pointer
 *
 * IMPORTANT: The returned keepAlive buffer must be kept in scope for the
 * pointer to remain valid. The caller is responsible for maintaining a
 * reference to the keepAlive buffer.
 *
 * @param str - The JavaScript string to convert
 * @returns An object containing the pointer and a buffer that must be kept alive
 */
export function cstringToPtr(str: string): CStringResult {
  const data = encoder.encode(str + "\0");
  const buffer = new Uint8Array(data);
  return {
    ptr: Deno.UnsafePointer.of(buffer),
    keepAlive: buffer,
  };
}
