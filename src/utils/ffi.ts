/**
 * Shared FFI utilities
 *
 * Provides common FFI operations used across multiple modules.
 */

// Pointer size is always 8 bytes on 64-bit systems
const POINTER_SIZE = 8;

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
  return new DataView(buffer.buffer).getBigUint64(0, true);
}

/**
 * Set a pointer in a buffer
 *
 * @param buffer - The buffer to write the pointer to
 * @param ptr - The pointer value to set
 */
export function setPointer(buffer: Uint8Array, ptr: bigint): void {
  new DataView(buffer.buffer).setBigUint64(0, ptr, true);
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
 * Convert a JavaScript string to a C string pointer
 *
 * @param str - The JavaScript string to convert
 * @returns A pointer to the encoded string data
 */
export function cstringToPtr(str: string): Deno.PointerValue {
  const data = encoder.encode(str + "\0");
  const buffer = new Uint8Array(data);
  return Deno.UnsafePointer.of(buffer);
}
