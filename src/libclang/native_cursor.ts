/**
 * Native CXCursor wrapper - can be properly passed to FFI functions
 *
 * CXCursor is a struct: { kind: u32, xdata: i32, data: [pointer, pointer, pointer] }
 * Total size: 4 + 4 + 24 = 32 bytes (but we use 40 for alignment)
 */

import type { CXCursor, NativePointer } from "../ffi/types.ts";

/**
 * Native buffer-based CXCursor that can be passed to FFI functions
 */
export class NativeCXCursor {
  private buffer: Uint8Array;

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

  getBuffer(): Uint8Array {
    return this.buffer;
  }

  getKind(): number {
    return new DataView(this.buffer.buffer).getUint32(0, true);
  }

  getXdata(): number {
    return new DataView(this.buffer.buffer).getInt32(4, true);
  }

  getData(index: number): bigint {
    return new DataView(this.buffer.buffer).getBigUint64(8 + index * 8, true);
  }

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
