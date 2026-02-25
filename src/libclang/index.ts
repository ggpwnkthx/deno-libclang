/**
 * Index functions
 */

import type { CXIndex } from "../ffi/types.ts";
import { getSymbols } from "./library.ts";

/**
 * Create a new index
 *
 * @param excludeDeclarationsFromPCH - If non-zero, declarations from PCH files are excluded
 * @param displayDiagnostics - If non-zero, diagnostic messages are displayed
 * @returns The created index
 */
export function createIndex(
  excludeDeclarationsFromPCH: boolean = false,
  displayDiagnostics: boolean = false,
): CXIndex {
  const sym = getSymbols();
  return sym.clang_createIndex(
    excludeDeclarationsFromPCH ? 1 : 0,
    displayDiagnostics ? 1 : 0,
  );
}

/**
 * Dispose of an index
 */
export function disposeIndex(index: CXIndex): void {
  const sym = getSymbols();
  sym.clang_disposeIndex(index);
}
