/**
 * Native CXCursor wrapper - can be properly passed to FFI functions
 *
 * CXCursor is a struct: { kind: u32, xdata: i32, data: [pointer, pointer, pointer] }
 * Total size: 4 + 4 + 3*POINTER_SIZE bytes
 *
 * This class provides a buffer-based representation of a CXCursor that can be
 * directly passed to FFI functions without needing to construct a full CXCursor object.
 */

import type { CXCursor, CXCursorKind } from "../ffi/types.ts";
import {
  bigintToPtrValue,
  CX_CURSOR_DATA0_OFFSET,
  CX_CURSOR_DATA1_OFFSET,
  CX_CURSOR_DATA2_OFFSET,
  CX_CURSOR_KIND_OFFSET,
  CX_CURSOR_SIZE,
  CX_CURSOR_XDATA_OFFSET,
  POINTER_SIZE,
  readPtr,
  writePtr,
} from "../utils/ffi.ts";

/**
 * Size of the CXCursor DataView for extracting cursor kind
 */
export const CURSOR_VIEW_SIZE = CX_CURSOR_SIZE;

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
    this.buffer = new Uint8Array(CX_CURSOR_SIZE);
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset,
      CX_CURSOR_SIZE,
    );
    view.setUint32(CX_CURSOR_KIND_OFFSET, kind, true); // kind: u32
    view.setInt32(CX_CURSOR_XDATA_OFFSET, xdata, true); // xdata: i32
    writePtr(view, CX_CURSOR_DATA0_OFFSET, data0); // data[0]: pointer at offset 8
    writePtr(view, CX_CURSOR_DATA1_OFFSET, data1); // data[1]: pointer at offset 8+POINTER_SIZE
    writePtr(view, CX_CURSOR_DATA2_OFFSET, data2); // data[2]: pointer at offset 8+POINTER_SIZE*2
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
    return new DataView(this.buffer.buffer).getUint32(
      CX_CURSOR_KIND_OFFSET,
      true,
    );
  }

  /**
   * Get the xdata field
   *
   * @returns The xdata integer value
   */
  getXdata(): number {
    return new DataView(this.buffer.buffer).getInt32(
      CX_CURSOR_XDATA_OFFSET,
      true,
    );
  }

  /**
   * Get a data pointer by index
   *
   * @param index - The index of the data pointer (0, 1, or 2)
   * @returns The data pointer as bigint
   */
  getData(index: number): bigint {
    return readPtr(
      new DataView(this.buffer.buffer),
      8 + index * POINTER_SIZE,
    );
  }

  /**
   * Convert to a CXCursor object
   *
   * @returns A CXCursor object representation
   */
  toCXCursor(): CXCursor {
    const view = new DataView(this.buffer.buffer);
    return {
      kind: view.getUint32(CX_CURSOR_KIND_OFFSET, true),
      xdata: view.getInt32(CX_CURSOR_XDATA_OFFSET, true),
      data: [
        bigintToPtrValue(readPtr(view, CX_CURSOR_DATA0_OFFSET)),
        bigintToPtrValue(readPtr(view, CX_CURSOR_DATA1_OFFSET)),
        bigintToPtrValue(readPtr(view, CX_CURSOR_DATA2_OFFSET)),
      ],
    };
  }
}
