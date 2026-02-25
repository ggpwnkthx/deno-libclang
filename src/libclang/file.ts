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
 * In LLVM 20+, clang_file_isNull was removed - check pointer directly
 */
export function fileIsNull(file: CXFile): boolean {
  // CXFile is a pointer - check if it's null
  return file === null || file === undefined || Number(file) === 0;
}

/**
 * Get a source location
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
