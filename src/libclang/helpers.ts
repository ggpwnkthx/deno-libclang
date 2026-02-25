/**
 * Helper functions
 */

import type {
  CXSourceLocation,
  CXSourceRange,
  SourceLocation,
  SourceRange,
} from "../ffi/types.ts";

/**
 * Parse a CXSourceLocation into a SourceLocation
 *
 * @param location - The CXSourceLocation from libclang
 * @returns A SourceLocation object with file, line, column, and offset
 */
export function parseSourceLocation(
  location: CXSourceLocation,
): SourceLocation {
  // The location is a struct with ptr_data and int_data
  // This is a simplified version
  return {
    file: null, // Would need to resolve from ptr_data
    line: location.int_data & 0xFFFFFFFF,
    column: (location.int_data >> 32) & 0xFFFFFFFF,
    offset: 0, // Would need additional API call
  };
}

/**
 * Parse a CXSourceRange into a SourceRange
 *
 * @param range - The CXSourceRange from libclang
 * @returns A SourceRange object with start and end locations
 */
export function parseSourceRange(range: CXSourceRange): SourceRange {
  return {
    start: parseSourceLocation(
      range.ptr_data[0] as unknown as CXSourceLocation,
    ),
    end: parseSourceLocation(range.ptr_data[1] as unknown as CXSourceLocation),
  };
}
