/**
 * Translation Unit functions
 */

import {
  type CXIndex,
  type CXTranslationUnit,
  CXTranslationUnit_Flags,
  type NativePointer,
  type ParseResult,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";

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
  _args: string[] = [],
  _unsavedFiles: unknown[] = [],
): ParseResult {
  const sym = getSymbols();

  // Convert sourceFile to a C-string pointer using native memory
  const sourceFileBuffer = new TextEncoder().encode(sourceFile + "\0");
  const sourceFilePtr = Deno.UnsafePointer.of(sourceFileBuffer);

  // Convert args to pointer array (simplified - using null for now)
  // In a full implementation, we'd allocate native memory for each string
  const result = sym.clang_parseTranslationUnit(
    index,
    sourceFilePtr as unknown as NativePointer,
    null, // commandLineArgs - simplified for now
    0, // numCommandLineArgs
    null, // unsavedFiles - simplified for now
    0, // numUnsavedFiles
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
  unsavedFiles: unknown[] = [],
): number {
  const sym = getSymbols();
  return sym.clang_reparseTranslationUnit(
    unit,
    unsavedFiles.length,
    null,
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
