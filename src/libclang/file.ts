/**
 * File and Location functions
 */

import type {
  CXFile,
  CXSourceLocation,
  CXTranslationUnit,
  NativePointer,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";

/**
 * Get a file from a translation unit
 *
 * @param unit - The translation unit
 * @param fileName - The name of the file to get
 * @returns The CXFile handle for the file
 */
export function getFile(unit: CXTranslationUnit, fileName: string): CXFile {
  const sym = getSymbols();
  // Convert fileName to a C-string pointer
  const fileNameBuffer = new TextEncoder().encode(fileName + "\0");
  const fileNamePtr = Deno.UnsafePointer.of(fileNameBuffer);
  return sym.clang_getFile(unit, fileNamePtr);
}

/**
 * Get the name of a file
 *
 * @param file - The CXFile to get the name from
 * @returns The file name string
 */
export function getFileName(file: CXFile): string {
  const sym = getSymbols();
  const cxString = sym.clang_getFileName(file);
  const cStr = sym.clang_getCString(cxString);
  const result = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  sym.clang_disposeString(cxString);
  return result;
}

/**
 * Check if a file is null
 *
 * In LLVM 20+, clang_file_isNull was removed - check pointer directly.
 *
 * @param file - The CXFile to check
 * @returns True if the file is null/invalid, false otherwise
 */
export function fileIsNull(file: CXFile): boolean {
  // CXFile is a NativePointer - check if it's null or undefined
  if (file === null || file === undefined) {
    return true;
  }
  // NativePointer can be checked with Deno.UnsafePointer.of(null)
  const ptr = file as unknown as Deno.PointerValue;
  return ptr === null;
}

/**
 * Get a source location from a file, line, and column
 *
 * @param unit - The translation unit
 * @param file - The CXFile
 * @param line - The line number (1-based)
 * @param column - The column number (1-based)
 * @returns The CXSourceLocation
 */
export function getLocation(
  unit: CXTranslationUnit,
  file: CXFile,
  line: number,
  column: number,
): CXSourceLocation {
  const sym = getSymbols();
  const result = sym.clang_getLocation(unit, file, line, column);

  // Deno FFI returns Uint8Array for struct returns - parse it manually
  if (result instanceof Uint8Array) {
    const view = new DataView(
      result.buffer,
      result.byteOffset,
      result.byteLength,
    );
    // CXSourceLocation: { ptr_data: [pointer, pointer], int_data: u32 }
    const ptr0 = view.getBigUint64(0, true);
    const ptr1 = view.getBigUint64(8, true);
    const int_data = view.getUint32(16, true);

    return {
      ptr_data: [
        ptr0 as unknown as NativePointer,
        ptr1 as unknown as NativePointer,
      ],
      int_data,
    };
  }

  return result;
}
