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
 */
export function createPointerBuffer(size: number = POINTER_SIZE): Uint8Array {
  return new Uint8Array(size);
}

/**
 * Extract a pointer from a buffer
 */
export function getPointer(buffer: Uint8Array): bigint {
  return new DataView(buffer.buffer).getBigUint64(0, true);
}

/**
 * Set a pointer in a buffer
 */
export function setPointer(buffer: Uint8Array, ptr: bigint): void {
  new DataView(buffer.buffer).setBigUint64(0, ptr, true);
}

/**
 * Convert a C string pointer to a JavaScript string
 */
export function ptrToCString(ptr: Deno.PointerValue): string {
  if (!ptr) return "";
  return new Deno.UnsafePointerView(ptr).getCString();
}

/**
 * Convert a JavaScript string to a C string pointer
 */
export function cstringToPtr(str: string): Deno.PointerValue {
  const data = encoder.encode(str + "\0");
  const buffer = new Uint8Array(data);
  return Deno.UnsafePointer.of(buffer);
}
