/**
 * Native CXCursor wrapper - can be properly passed to FFI functions
 *
 * CXCursor is a struct: { kind: u32, xdata: i32, data: [pointer, pointer, pointer] }
 * Total size: 4 + 4 + 24 = 32 bytes (but we use 40 for alignment)
 *
 * This class provides a buffer-based representation of a CXCursor that can be
 * directly passed to FFI functions without needing to construct a full CXCursor object.
 */

import type { CXCursor, CXCursorKind, NativePointer } from "../ffi/types.ts";

/**
 * Size of the CXCursor DataView for extracting cursor kind
 */
export const CURSOR_VIEW_SIZE = 40;

/**
 * Extract cursor kind from a buffer using DataView
 *
 * @param buffer - The Uint8Array buffer containing the native CXCursor data
 * @returns The CXCursorKind value
 */
export function getCursorKindFromBuffer(buffer: Uint8Array): CXCursorKind {
  const view = new DataView(buffer.buffer, buffer.byteOffset, CURSOR_VIEW_SIZE);
  return view.getUint32(0, true) as CXCursorKind;
}

/**
 * Convert buffer to CXCursor type for use with libclang functions
 *
 * @param buffer - The Uint8Array buffer containing the native CXCursor data
 * @returns The buffer cast as CXCursor
 */
export function toCursor(buffer: Uint8Array): CXCursor {
  return buffer as unknown as CXCursor;
}

/**
 * Native buffer-based CXCursor that can be passed to FFI functions
 *
 * Used internally when working with cursors from visitChildren callbacks.
 * The raw buffer can be passed directly to FFI functions while also
 * providing methods to extract individual fields.
 */
export class NativeCXCursor {
  private buffer: Uint8Array;

  /**
   * Create a native CXCursor from its components
   *
   * @param kind - The cursor kind (CXCursorKind value)
   * @param xdata - Extra data field
   * @param data0 - First data pointer
   * @param data1 - Second data pointer
   * @param data2 - Third data pointer
   */
  constructor(
    kind: number,
    xdata: number,
    data0: bigint,
    data1: bigint,
    data2: bigint,
  ) {
    // 5 fields * 8 bytes = 40 bytes
    this.buffer = new Uint8Array(40);
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, 40);
    view.setUint32(0, kind, true); // kind: u32
    view.setInt32(4, xdata, true); // xdata: i32
    view.setBigUint64(8, data0, true); // data[0]: pointer
    view.setBigUint64(16, data1, true); // data[1]: pointer
    view.setBigUint64(24, data2, true); // data[2]: pointer
  }

  /**
   * Get the raw buffer
   *
   * @returns The Uint8Array buffer containing the native CXCursor data
   */
  getBuffer(): Uint8Array {
    return this.buffer;
  }

  /**
   * Get the cursor kind
   *
   * @returns The cursor kind value
   */
  getKind(): number {
    return new DataView(this.buffer.buffer).getUint32(0, true);
  }

  /**
   * Get the xdata field
   *
   * @returns The xdata integer value
   */
  getXdata(): number {
    return new DataView(this.buffer.buffer).getInt32(4, true);
  }

  /**
   * Get a data pointer by index
   *
   * @param index - The index of the data pointer (0, 1, or 2)
   * @returns The data pointer as bigint
   */
  getData(index: number): bigint {
    return new DataView(this.buffer.buffer).getBigUint64(8 + index * 8, true);
  }

  /**
   * Convert to a CXCursor object
   *
   * @returns A CXCursor object representation
   */
  toCXCursor(): CXCursor {
    const view = new DataView(this.buffer.buffer);
    return {
      kind: view.getUint32(0, true),
      xdata: view.getInt32(4, true),
      data: [
        view.getBigUint64(8, true) as unknown as NativePointer,
        view.getBigUint64(16, true) as unknown as NativePointer,
        view.getBigUint64(24, true) as unknown as NativePointer,
      ],
    };
  }
}
