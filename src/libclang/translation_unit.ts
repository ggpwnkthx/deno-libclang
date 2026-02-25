/**
 * Translation Unit functions
 */

import {
  type CXIndex,
  type CXTranslationUnit,
  CXTranslationUnit_Flags,
  type CXUnsavedFile,
  type NativePointer,
  type ParseResult,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";

/**
 * Convert a string array to a native pointer array (for command line args)
 *
 * Note: This implementation is simplified and returns null. Full support for
 * command line arguments requires persistent native memory allocation which is
 * complex in Deno FFI.
 *
 * @param _args - Array of string arguments (unused for now)
 * @returns Object with pointer (always null for now) and empty buffers
 */
function argsToNativePointer(_args: string[]): {
  ptr: NativePointer;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _keepAlive: Uint8Array[];
} {
  // Return null pointer for now - command line args not fully implemented
  return { ptr: null as unknown as NativePointer, _keepAlive: [] };
}

/**
 * Convert CXUnsavedFile array to native memory pointer
 *
 * Note: This implementation is simplified and returns null. Full support for
 * unsaved files requires persistent native memory allocation which is
 * complex in Deno FFI.
 *
 * @param _unsavedFiles - Array of unsaved files (unused for now)
 * @returns Object with pointer (always null for now) and empty buffers
 */
function unsavedFilesToNativePointer(
  _unsavedFiles: CXUnsavedFile[],
): {
  ptr: NativePointer;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _keepAlive: Uint8Array[];
} {
  // Return null pointer for now - unsaved files not fully implemented
  return { ptr: null as unknown as NativePointer, _keepAlive: [] };
}

/**
 * Parse a translation unit from source code
 *
 * @param index - The CXIndex to use for parsing
 * @param sourceFile - Path to the source file to parse
 * @param args - Optional additional command-line arguments for the compiler
 * @param unsavedFiles - Optional files that haven't been saved to disk
 * @returns ParseResult containing the translation unit or error
 */
export function parseTranslationUnit(
  index: CXIndex,
  sourceFile: string,
  args: string[] = [],
  unsavedFiles: CXUnsavedFile[] = [],
): ParseResult {
  const sym = getSymbols();

  // Convert sourceFile to a C-string pointer using native memory
  const sourceFileBuffer = new TextEncoder().encode(sourceFile + "\0");
  const sourceFilePtr = Deno.UnsafePointer.of(sourceFileBuffer);

  // Convert args to native pointer array
  const argsResult = argsToNativePointer(args);

  // Convert unsaved files to native pointer
  const unsavedFilesResult = unsavedFilesToNativePointer(unsavedFiles);

  // Only pass unsavedFiles pointer if we have files
  const unsavedPtr = unsavedFiles.length > 0
    ? unsavedFilesResult.ptr as unknown as NativePointer
    : null;

  const result = sym.clang_parseTranslationUnit(
    index,
    sourceFilePtr as unknown as NativePointer,
    args.length > 0 ? argsResult.ptr as unknown as NativePointer : null,
    args.length,
    unsavedPtr,
    unsavedFiles.length,
    CXTranslationUnit_Flags.None,
  );

  if (!result) {
    return {
      translationUnit: null,
      error: "Failed to parse translation unit",
    };
  }

  return { translationUnit: result };
}

/**
 * Dispose of a translation unit
 *
 * @param unit - The translation unit to dispose
 */
export function disposeTranslationUnit(unit: CXTranslationUnit): void {
  const sym = getSymbols();
  sym.clang_disposeTranslationUnit(unit);
}

/**
 * Reparse a translation unit
 *
 * @param unit - The translation unit to reparse
 * @param unsavedFiles - Optional unsaved files to include in reparsing
 * @returns Number indicating success (0) or failure (non-zero)
 */
export function reparseTranslationUnit(
  unit: CXTranslationUnit,
  unsavedFiles: CXUnsavedFile[] = [],
): number {
  const sym = getSymbols();

  // Convert unsaved files to native pointer
  const unsavedFilesResult = unsavedFilesToNativePointer(unsavedFiles);

  // Only pass unsavedFiles pointer if we have files
  const unsavedPtr = unsavedFiles.length > 0
    ? unsavedFilesResult.ptr as unknown as NativePointer
    : null;

  return sym.clang_reparseTranslationUnit(
    unit,
    unsavedFiles.length,
    unsavedPtr,
    CXTranslationUnit_Flags.None,
  );
}

/**
 * Get the cursor for a translation unit
 *
 * @param unit - The translation unit to get the cursor from
 * @returns CXCursor representing the translation unit
 */
export function getTranslationUnitCursor(
  unit: CXTranslationUnit,
): {
  kind: number;
  xdata: number;
  data: [NativePointer, NativePointer, NativePointer];
} {
  const sym = getSymbols();
  return sym.clang_getTranslationUnitCursor(unit);
}
