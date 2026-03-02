/**
 * Helper functions
 */

import type {
  CXCursor,
  CXFile,
  CXSourceLocation,
  CXSourceRange,
  CXString,
  CXType,
  NativePointer,
  SourceLocation,
  SourceRange,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";
import { getFileName } from "./file.ts";
import { bigintToPtrValue, POINTER_SIZE } from "../utils/ffi.ts";

/**
 * Convert a CXString to a JavaScript string
 *
 * This is the common pattern for extracting strings from libclang CXString returns.
 *
 * @param cxString - The CXString to convert
 * @returns The JavaScript string
 */
export function cxStringToString(cxString: CXString): string {
  const sym = getSymbols();
  const cStr = sym.clang_getCString(cxString);
  const result = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  sym.clang_disposeString(cxString);
  return result;
}

/**
 * Convert CXCursor from either a native CXCursor object or Uint8Array buffer
 *
 * When visiting children, libclang returns cursor data as a buffer that needs
 * to be passed to FFI functions. This helper normalizes both input types.
 *
 * @param cursor - CXCursor object or Uint8Array buffer
 * @returns The CXCursor in native form
 */
export function toNativeCursor(cursor: CXCursor | Uint8Array): CXCursor {
  return cursor instanceof Uint8Array ? cursor as unknown as CXCursor : cursor;
}

/**
 * Convert CXType from either a native CXType object or Uint8Array buffer
 *
 * When working with types, libclang may return type data as a buffer that needs
 * to be passed to FFI functions. This helper normalizes both input types.
 *
 * @param type - CXType object or Uint8Array buffer
 * @returns The CXType in native form
 */
export function toNativeType(type: CXType | Uint8Array): CXType {
  return type instanceof Uint8Array ? type as unknown as CXType : type;
}

/**
 * Parse a CXSourceLocation into a SourceLocation
 *
 * Uses clang_getSpellingLocation to properly extract file, line, column, and offset.
 *
 * @param location - The CXSourceLocation from libclang (struct return or CXSourceLocation object)
 * @returns A SourceLocation object with file, line, column, and offset
 */
export function parseSourceLocation(
  location: CXSourceLocation | Uint8Array,
): SourceLocation {
  const sym = getSymbols();

  // Prepare location in the format expected by clang_getSpellingLocation
  // For CXSourceLocation object, convert to buffer
  let locationBuffer: Uint8Array;
  const _filePtrVal: NativePointer | null = null;

  if (location instanceof Uint8Array) {
    locationBuffer = location;
  } else if (location && typeof location === "object" && location.ptr_data) {
    // Create buffer from CXSourceLocation object
    locationBuffer = new Uint8Array(POINTER_SIZE * 2 + 4);
    const view = new DataView(
      locationBuffer.buffer,
      locationBuffer.byteOffset,
      locationBuffer.byteLength,
    );

    // ptr_data[0] - file pointer
    const ptr0 = location.ptr_data[0];
    const ptr0Val = typeof ptr0 === "bigint" ? ptr0 : 0n;
    if (POINTER_SIZE === 8) {
      view.setBigUint64(0, ptr0Val, true);
    } else {
      view.setUint32(0, Number(ptr0Val), true);
    }

    // ptr_data[1]
    const ptr1 = location.ptr_data[1];
    const ptr1Val = typeof ptr1 === "bigint" ? ptr1 : 0n;
    if (POINTER_SIZE === 8) {
      view.setBigUint64(POINTER_SIZE, ptr1Val, true);
    } else {
      view.setUint32(POINTER_SIZE, Number(ptr1Val), true);
    }

    // int_data
    const intData = typeof location.int_data === "number"
      ? location.int_data
      : 0;
    view.setUint32(POINTER_SIZE * 2, intData, true);
  } else {
    // Invalid location
    return { file: null, line: 0, column: 0, offset: 0 };
  }

  // Create buffers for output parameters
  const fileBuf = new Uint8Array(POINTER_SIZE);
  const lineBuf = new Uint8Array(POINTER_SIZE);
  const colBuf = new Uint8Array(POINTER_SIZE);
  const offsetBuf = new Uint8Array(POINTER_SIZE);

  // Get pointers to the buffers
  const fileBufPtr = Deno.UnsafePointer.of(fileBuf);
  const lineBufPtr = Deno.UnsafePointer.of(lineBuf);
  const colBufPtr = Deno.UnsafePointer.of(colBuf);
  const offsetBufPtr = Deno.UnsafePointer.of(offsetBuf);

  // Call clang_getSpellingLocation
  // Parameters: location, file*, line*, column*, offset*
  sym.clang_getSpellingLocation(
    locationBuffer as unknown as CXSourceLocation,
    fileBufPtr,
    lineBufPtr,
    colBufPtr,
    offsetBufPtr,
  );

  // Read output values from the buffers
  const lineView = new DataView(
    lineBuf.buffer,
    lineBuf.byteOffset,
    POINTER_SIZE,
  );
  const colView = new DataView(colBuf.buffer, colBuf.byteOffset, POINTER_SIZE);
  const offsetView = new DataView(
    offsetBuf.buffer,
    offsetBuf.byteOffset,
    POINTER_SIZE,
  );

  const line = POINTER_SIZE === 8
    ? Number(lineView.getBigUint64(0, true))
    : lineView.getUint32(0, true);
  const column = POINTER_SIZE === 8
    ? Number(colView.getBigUint64(0, true))
    : colView.getUint32(0, true);
  const offset = POINTER_SIZE === 8
    ? Number(offsetView.getBigUint64(0, true))
    : offsetView.getUint32(0, true);

  // Read the file pointer from output
  const fileView = new DataView(
    fileBuf.buffer,
    fileBuf.byteOffset,
    POINTER_SIZE,
  );
  const filePtr = POINTER_SIZE === 8
    ? fileView.getBigUint64(0, true)
    : BigInt(fileView.getUint32(0, true));

  // Get the file name from the file pointer
  let file: string | null = null;
  if (filePtr !== 0n) {
    try {
      const cxFile = bigintToPtrValue(filePtr) as unknown as CXFile;
      const name = getFileName(cxFile);
      if (name) {
        file = name;
      }
    } catch {
      // Return null for file if we can't get the name
      file = null;
    }
  }

  return {
    file,
    line,
    column,
    offset,
  };
}

/**
 * Parse a CXSourceRange into a SourceRange
 *
 * Uses clang_getRangeStart and clang_getRangeEnd to get proper location data.
 *
 * @param range - The CXSourceRange from libclang (struct return or CXSourceRange object)
 * @returns A SourceRange object with start and end locations
 */
export function parseSourceRange(
  range: CXSourceRange | Uint8Array,
): SourceRange {
  const sym = getSymbols();

  // For CXSourceRange object, convert to buffer; for Uint8Array use directly
  let rangeBuffer: Uint8Array;

  if (range instanceof Uint8Array) {
    rangeBuffer = range;
  } else if (range && typeof range === "object" && range.ptr_data) {
    rangeBuffer = new Uint8Array(POINTER_SIZE * 2 + 8);
    const view = new DataView(
      rangeBuffer.buffer,
      rangeBuffer.byteOffset,
      rangeBuffer.byteLength,
    );

    // ptr_data[0] - start location
    const ptr0 = range.ptr_data[0];
    const ptr0Val = typeof ptr0 === "bigint" ? ptr0 : 0n;
    if (POINTER_SIZE === 8) {
      view.setBigUint64(0, ptr0Val, true);
    } else {
      view.setUint32(0, Number(ptr0Val), true);
    }

    // ptr_data[1] - end location
    const ptr1 = range.ptr_data[1];
    const ptr1Val = typeof ptr1 === "bigint" ? ptr1 : 0n;
    if (POINTER_SIZE === 8) {
      view.setBigUint64(POINTER_SIZE, ptr1Val, true);
    } else {
      view.setUint32(POINTER_SIZE, Number(ptr1Val), true);
    }

    // int_data[0] and int_data[1]
    if (Array.isArray(range.int_data)) {
      view.setUint32(POINTER_SIZE * 2, range.int_data[0] || 0, true);
      view.setUint32(POINTER_SIZE * 2 + 4, range.int_data[1] || 0, true);
    }
  } else {
    return {
      start: { file: null, line: 0, column: 0, offset: 0 },
      end: { file: null, line: 0, column: 0, offset: 0 },
    };
  }

  try {
    const startLocation = sym.clang_getRangeStart(
      rangeBuffer as unknown as CXSourceRange,
    );
    const endLocation = sym.clang_getRangeEnd(
      rangeBuffer as unknown as CXSourceRange,
    );

    return {
      start: parseSourceLocation(startLocation),
      end: parseSourceLocation(endLocation),
    };
  } catch {
    return {
      start: { file: null, line: 0, column: 0, offset: 0 },
      end: { file: null, line: 0, column: 0, offset: 0 },
    };
  }
}
