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
 * @param index - The index to use
 * @param sourceFile - Path to the source file to parse
 * @param args - Additional command-line arguments for the compiler
 * @param unsavedFiles - Files that haven't been saved to disk
 * @returns The parse function parseTranslationUnit result
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
 */
export function disposeTranslationUnit(unit: CXTranslationUnit): void {
  const sym = getSymbols();
  sym.clang_disposeTranslationUnit(unit);
}

/**
 * Reparse a translation unit
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
