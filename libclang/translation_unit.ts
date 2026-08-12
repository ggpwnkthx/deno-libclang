/**
 * Translation Unit functions
 */

import {
  type CXIndex,
  type CXString,
  type CXTranslationUnit,
  CXTranslationUnit_Flags,
  type CXUnsavedFile,
  type NativePointer,
  type ParseResult,
} from "../ffi/types.ts";
import { getLibraryResourceDir, getSymbols } from "./library.ts";
import { POINTER_SIZE, ULONG_SIZE, writePtr } from "../utils/ffi.ts";

/**
 * Convert a string array to a native pointer array (for command line args)
 *
 * @param args - Array of string arguments
 * @returns Object with pointer to the char** array and buffers to keep alive
 */
function argsToNativePointer(args: string[]): {
  ptr: NativePointer;
  _keepAlive: Uint8Array[];
} {
  if (args.length === 0) {
    return { ptr: null as unknown as NativePointer, _keepAlive: [] };
  }

  const _keepAlive: Uint8Array[] = [];

  // Create buffers for each argument (null-terminated C strings)
  const argBuffers: Uint8Array[] = [];
  for (const arg of args) {
    const buffer = new TextEncoder().encode(arg + "\0");
    argBuffers.push(buffer);
    _keepAlive.push(buffer);
  }

  // Create array of pointers to each argument string
  // Each pointer is POINTER_SIZE bytes
  const ptrArraySize = args.length * POINTER_SIZE;
  const ptrArray = new Uint8Array(ptrArraySize);
  _keepAlive.push(ptrArray);

  // Fill the pointer array with addresses of each argument buffer
  const view = new DataView(
    ptrArray.buffer,
    ptrArray.byteOffset,
    ptrArray.byteLength,
  );
  for (let i = 0; i < args.length; i++) {
    const ptr = Deno.UnsafePointer.of(argBuffers[i] as Uint8Array<ArrayBuffer>);
    const ptrValue = Deno.UnsafePointer.value(ptr);
    writePtr(view, i * POINTER_SIZE, ptrValue);
  }

  return {
    ptr: Deno.UnsafePointer.of(ptrArray as Uint8Array<ArrayBuffer>),
    _keepAlive,
  };
}

/**
 * Convert CXUnsavedFile array to native memory pointer
 *
 * @param unsavedFiles - Array of unsaved files
 * @returns Object with pointer to the CXUnsavedFile array and buffers to keep alive
 */
function unsavedFilesToNativePointer(
  unsavedFiles: CXUnsavedFile[],
): {
  ptr: NativePointer;
  _keepAlive: Uint8Array[];
} {
  if (unsavedFiles.length === 0) {
    return { ptr: null as unknown as NativePointer, _keepAlive: [] };
  }

  const _keepAlive: Uint8Array[] = [];

  // CXUnsavedFile struct:
  // - filename: const char*
  // - contents: const char*
  // - length: unsigned long (ULONG_SIZE bytes)
  // Total size: POINTER_SIZE + POINTER_SIZE + ULONG_SIZE

  const structSize = POINTER_SIZE * 2 + ULONG_SIZE;
  const totalSize = unsavedFiles.length * structSize;
  const structArray = new Uint8Array(totalSize);
  _keepAlive.push(structArray);

  const view = new DataView(
    structArray.buffer,
    structArray.byteOffset,
    structArray.byteLength,
  );

  // Store encoded strings for each file
  const filenameBuffers: Uint8Array[] = [];
  const contentsBuffers: Uint8Array[] = [];

  for (let i = 0; i < unsavedFiles.length; i++) {
    const file = unsavedFiles[i];

    // Encode filename as null-terminated C string
    const filenameBuffer = new TextEncoder().encode(file.filename + "\0");
    filenameBuffers.push(filenameBuffer);
    _keepAlive.push(filenameBuffer);

    // Encode contents - use UTF-8 byte length (not file.length)
    const contentsBuffer = new TextEncoder().encode(file.contents);
    const contentsLength = contentsBuffer.byteLength;
    contentsBuffers.push(contentsBuffer);
    _keepAlive.push(contentsBuffer);

    // Set struct fields at offset i * structSize
    const offset = i * structSize;

    // filename pointer (offset 0)
    const filenamePtr = Deno.UnsafePointer.of(
      filenameBuffer as Uint8Array<ArrayBuffer>,
    );
    writePtr(view, offset, Deno.UnsafePointer.value(filenamePtr));

    // contents pointer (offset POINTER_SIZE)
    const contentsPtr = Deno.UnsafePointer.of(
      contentsBuffer as Uint8Array<ArrayBuffer>,
    );
    writePtr(
      view,
      offset + POINTER_SIZE,
      Deno.UnsafePointer.value(contentsPtr),
    );

    // length (offset POINTER_SIZE * 2) - use UTF-8 byte length
    if (ULONG_SIZE === 8) {
      view.setBigUint64(
        offset + POINTER_SIZE * 2,
        BigInt(contentsLength),
        true,
      );
    } else {
      view.setUint32(offset + POINTER_SIZE * 2, contentsLength, true);
    }
  }

  return {
    ptr: Deno.UnsafePointer.of(structArray as Uint8Array<ArrayBuffer>),
    _keepAlive,
  };
}

/**
 * Options accepted by {@link parseTranslationUnit}.
 */
export interface ParseTranslationUnitOptions {
  /**
   * If `true`, do not auto-inject `-resource-dir` even when the library has
   * resolved one. Useful when the user wants to rely on libclang's own
   * bundled resource directory (rare) or has already injected an explicit
   * `-resource-dir` via `args`.
   *
   * Defaults to `false`: `-resource-dir` is auto-injected when the user
   * hasn't already provided one and the library resolved a directory.
   */
  disableImplicitResourceDir?: boolean;
}

/**
 * Returns `true` if `args` already contains a `-resource-dir` flag in either
 * form. Used to skip auto-injection when the caller supplied their own.
 */
function argsHaveResourceDir(args: readonly string[]): boolean {
  for (const a of args) {
    if (a === "-resource-dir") return true;
    if (a.startsWith("-resource-dir=")) return true;
  }
  return false;
}

/**
 * Parse a translation unit from source code
 *
 * @param index - The CXIndex to use for parsing
 * @param sourceFile - Path to the source file to parse
 * @param args - Optional additional command-line arguments for the compiler
 * @param unsavedFiles - Optional files that haven't been saved to disk
 * @param options - Optional parser options (e.g. disable `-resource-dir` auto-injection)
 * @returns ParseResult containing the translation unit or error
 */
export function parseTranslationUnit(
  index: CXIndex,
  sourceFile: string,
  args: string[] = [],
  unsavedFiles: CXUnsavedFile[] = [],
  options: ParseTranslationUnitOptions = {},
): ParseResult {
  // Validate inputs
  if (!index) {
    return {
      translationUnit: null,
      error: "Invalid index: CXIndex is null or undefined",
    };
  }

  if (!sourceFile || typeof sourceFile !== "string") {
    return {
      translationUnit: null,
      error: "Invalid sourceFile: must be a non-empty string",
    };
  }

  // Auto-inject `-resource-dir` so libclang can find builtin headers
  // (e.g. on keg-only Homebrew installs where its own heuristic misses).
  // Prepended (not appended) so user-supplied `-resource-dir` always wins.
  let effectiveArgs = args;
  if (
    !options.disableImplicitResourceDir &&
    !argsHaveResourceDir(args)
  ) {
    const rd = getLibraryResourceDir();
    if (rd) {
      effectiveArgs = ["-resource-dir", rd, ...args];
    }
  }

  const sym = getSymbols();

  // Convert sourceFile to a C-string pointer using native memory
  const sourceFileBuffer = new TextEncoder().encode(sourceFile + "\0");
  const sourceFilePtr = Deno.UnsafePointer.of(sourceFileBuffer);

  // Convert args to native pointer array
  const argsResult = argsToNativePointer(effectiveArgs);

  // Convert unsaved files to native pointer
  const unsavedFilesResult = unsavedFilesToNativePointer(unsavedFiles);

  // Only pass unsavedFiles pointer if we have files
  const unsavedPtr = unsavedFiles.length > 0
    ? unsavedFilesResult.ptr as unknown as NativePointer
    : null;

  const result = sym.clang_parseTranslationUnit(
    index,
    sourceFilePtr as unknown as NativePointer,
    effectiveArgs.length > 0
      ? argsResult.ptr as unknown as NativePointer
      : null,
    effectiveArgs.length,
    unsavedPtr,
    unsavedFiles.length,
    CXTranslationUnit_Flags.None,
  );

  // Build keepAlive array with all buffers that need to stay alive
  const _keepAlive: Uint8Array[] = [sourceFileBuffer];
  _keepAlive.push(...argsResult._keepAlive);
  _keepAlive.push(...unsavedFilesResult._keepAlive);

  if (!result) {
    return {
      translationUnit: null,
      error: "Failed to parse translation unit",
      _keepAlive,
    };
  }

  return { translationUnit: result, _keepAlive };
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
/**
 * Extract the underlying C string from a CXString and dispose it.
 */
function cxStringToString(cx: CXString): string {
  const sym = getSymbols();
  const cStr = sym.clang_getCString(cx);
  const result = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  sym.clang_disposeString(cx);
  return result;
}

/**
 * Get the resource directory path that libclang is actually using for this
 * translation unit.
 *
 * Calls `clang_getResourceDirName` on the TU and returns the resulting
 * directory. Useful as a diagnostic when parsing fails to find builtin
 * headers (`stddef.h`, etc.) — the returned path is what libclang looked
 * at, regardless of whether the library auto-injected `-resource-dir`.
 *
 * Returns the empty string when the loaded libclang does not export
 * `clang_getResourceDirName` (e.g. some libclang 21+ builds have removed
 * it). When that happens, prefer {@link getLibraryResourceDir} for the
 * path this library resolved.
 *
 * @param unit - The translation unit to query
 * @returns The resource directory path (possibly empty string)
 */
export function getResourceDir(unit: CXTranslationUnit): string {
  const sym = getSymbols();
  const fn = sym.clang_getResourceDirName;
  if (fn === null || fn === undefined) {
    return "";
  }
  try {
    const cxString = fn(unit);
    return cxStringToString(cxString);
  } catch {
    // Deno returns a stub for missing optional symbols that throws "call
    // is not a function" when invoked. Fall through to the empty string.
    return "";
  }
}
