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
  // Each pointer is 8 bytes on 64-bit systems
  const ptrArraySize = args.length * 8;
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
    view.setBigUint64(i * 8, ptrValue, true);
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
  // - length: unsigned long (8 bytes on 64-bit)
  // Total size: 8 + 8 + 8 = 24 bytes per struct

  const structSize = 24;
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

    // Encode contents as null-terminated C string
    const contentsBuffer = new TextEncoder().encode(file.contents + "\0");
    contentsBuffers.push(contentsBuffer);
    _keepAlive.push(contentsBuffer);

    // Set struct fields at offset i * 24
    const offset = i * structSize;

    // filename pointer (offset 0)
    const filenamePtr = Deno.UnsafePointer.of(
      filenameBuffer as Uint8Array<ArrayBuffer>,
    );
    view.setBigUint64(offset, Deno.UnsafePointer.value(filenamePtr), true);

    // contents pointer (offset 8)
    const contentsPtr = Deno.UnsafePointer.of(
      contentsBuffer as Uint8Array<ArrayBuffer>,
    );
    view.setBigUint64(
      offset + 8,
      Deno.UnsafePointer.value(contentsPtr),
      true,
    );

    // length (offset 16)
    view.setBigUint64(offset + 16, BigInt(file.length), true);
  }

  return {
    ptr: Deno.UnsafePointer.of(structArray as Uint8Array<ArrayBuffer>),
    _keepAlive,
  };
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
