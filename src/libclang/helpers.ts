/**
 * Helper functions
 */

import type {
  CXFile,
  CXSourceLocation,
  CXSourceRange,
  SourceLocation,
  SourceRange,
} from "../ffi/types.ts";
import { getFileName } from "./file.ts";

/**
 * Parse a CXSourceLocation into a SourceLocation
 *
 * @param location - The CXSourceLocation from libclang
 * @returns A SourceLocation object with file, line, column, and offset
 */
export function parseSourceLocation(
  location: CXSourceLocation,
): SourceLocation {
  // Parse the CXSourceLocation struct
  // CXSourceLocation has: ptr_data: [NativePointer, NativePointer], int_data: number
  let filePtr: Deno.PointerValue | null = null;
  let line = 0;
  let column = 0;

  if (location && typeof location === "object") {
    // Handle case where location is already parsed
    if (location.ptr_data) {
      filePtr = location.ptr_data[0] as Deno.PointerValue | null;
      // int_data contains line in lower bits, column in upper bits
      const intData = location.int_data as number;
      line = intData & 0xFFFFFFFF;
      column = (intData >> 32) & 0xFFFFFFFF;
    }
  }

  const offset = 0;

  // Get the file name from the file pointer
  let file: string | null = null;
  if (filePtr && filePtr !== null) {
    try {
      const cxFile = filePtr as unknown as CXFile;
      const name = getFileName(cxFile);
      if (name) {
        file = name;
      }
    } catch (_e) {
      // Return null for file if we can't get the name - this is a valid fallback
      // rather than throwing an error for internal FFI issues
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
 * @param range - The CXSourceRange from libclang
 * @returns A SourceRange object with start and end locations
 */
export function parseSourceRange(range: CXSourceRange): SourceRange {
  // Handle null or invalid ranges
  if (!range.ptr_data || !range.ptr_data[0] || !range.ptr_data[1]) {
    return {
      start: { file: null, line: 0, column: 0, offset: 0 },
      end: { file: null, line: 0, column: 0, offset: 0 },
    };
  }
  return {
    start: parseSourceLocation(
      range.ptr_data[0] as unknown as CXSourceLocation,
    ),
    end: parseSourceLocation(range.ptr_data[1] as unknown as CXSourceLocation),
  };
}
