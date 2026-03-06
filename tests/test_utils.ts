/**
 * Shared test utilities for libclang tests
 *
 * Provides:
 * - requireLibclang(): Skip test if libclang is not available
 * - withLibclangTest(): Async test wrapper with mutex and automatic cleanup
 * - withLibclang(): Lower-level mutex acquire/cleanup helper
 * - parseC(): Parse code and get TU cursor with automatic cleanup
 * - Cursor search helpers: findChildByKind, findChildByKindAndSpelling, findDescendant
 */

import { assertExists } from "@std/assert";
import {
  createIndex,
  disposeIndex,
  disposeTranslationUnit,
  getCursorSpellingFromBuffer,
  getTranslationUnitCursor,
  load,
  parseTranslationUnit,
  unload,
  visitChildren,
} from "../mod.ts";
import { CXChildVisitResult, CXCursorKind } from "../mod.ts";
import type { CXCursor } from "../src/ffi/types.ts";
import { CX_CURSOR_SIZE } from "../src/utils/ffi.ts";

/**
 * Assert that a string contains a substring
 */
export function assertStringIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected "${actual}" to include "${expected}"`);
  }
}

let _libclangLoaded = false;
let _loadPromise: Promise<void> | null = null;

/**
 * Simple mutex for load/unload operations to ensure concurrency safety
 */
const loadMutex = {
  /**
   * Acquire the mutex and load libclang
   */
  async acquire(): Promise<void> {
    // If already loaded, we're done
    if (_libclangLoaded) {
      return;
    }

    // Wait for any existing load to complete
    while (_loadPromise) {
      await _loadPromise;
    }

    // If still not loaded after waiting, load now
    if (!_libclangLoaded) {
      _loadPromise = (async () => {
        try {
          load();
          _libclangLoaded = true;
          // Ensure we return a Promise to match _loadPromise type
          await Promise.resolve();
        } finally {
          _loadPromise = null;
        }
      })();
      await _loadPromise;
    }
  },

  /**
   * Release the mutex and unload libclang
   */
  release(): void {
    unload();
    _libclangLoaded = false;
  },
};

/**
 * Load the libclang library with mutex for concurrency safety.
 * Use this instead of direct load() in parallel tests.
 */
export async function setupLib(): Promise<void> {
  await loadMutex.acquire();
}

/**
 * Check if libclang is available, throws if not.
 * Usage: call this at the start of a test to fail fast if libclang is missing.
 */
export function requireLibclang(): void {
  try {
    load();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `libclang not installed - install libclang-dev or equivalent: ${msg}`,
    );
  }
}

/**
 * Check if libclang is available without throwing.
 * Returns true if libclang can be loaded.
 */
export function isLibclangAvailable(): boolean {
  try {
    load();
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquire libclang with mutex for concurrency safety.
 * Use this instead of direct load() in parallel tests.
 */
export async function acquireLibclang(): Promise<void> {
  await loadMutex.acquire();
}

/**
 * Release libclang (use with caution in parallel tests).
 */
export function releaseLibclang(): void {
  loadMutex.release();
}

/**
 * Unload the libclang library. Should be called at the end of each test.
 */
export function teardownLib(): void {
  unload();
}

/**
 * Lower-level helper that acquires mutex, loads libclang, and returns cleanup function.
 * Use this when you need more control than withLibclangTest provides.
 *
 * Usage:
 * ```ts
 * Deno.test({
 *   name: "test name",
 *   async fn() {
 *     const cleanup = await withLibclang();
 *     try {
 *       // test code
 *     } finally {
 *       await cleanup();
 *     }
 *   }
 * });
 * ```
 *
 * @returns Promise that resolves to cleanup function
 */
export async function withLibclang(): Promise<() => void> {
  await loadMutex.acquire();
  return () => {
    loadMutex.release();
  };
}

/**
 * Parse C code and return resources with automatic cleanup.
 *
 * @param code - The C code to parse
 * @param opts - Optional parse options
 * @returns Object with index, tu, tuCursor, file, and cleanup function
 */
export async function parseC(
  code: string,
  opts?: {
    args?: string[];
    unsaved?: Array<{ filename: string; contents: string; length: number }>;
  },
): Promise<{
  index: ReturnType<typeof createIndex>;
  tu: NonNullable<ReturnType<typeof parseTranslationUnit>["translationUnit"]>;
  tuCursor: ReturnType<typeof getTranslationUnitCursor>;
  file: string;
  cleanup: () => Promise<void>;
}> {
  await loadMutex.acquire();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, code);

  const result = parseTranslationUnit(
    index,
    file,
    opts?.args ?? [],
    opts?.unsaved ?? [],
  );
  assertExists(result.translationUnit);

  const tuCursor = getTranslationUnitCursor(result.translationUnit);

  const cleanup = async () => {
    disposeTranslationUnit(result.translationUnit);
    disposeIndex(index);
    await Deno.remove(file);
    loadMutex.release();
  };

  return {
    index,
    tu: result.translationUnit,
    tuCursor,
    file,
    cleanup,
  };
}

/**
 * Find the first child cursor of a specific kind
 *
 * @param cursor - The parent cursor (buffer or CXCursor)
 * @param kind - The cursor kind to find
 * @returns The cursor buffer if found, undefined otherwise
 */
export function findChildByKind(
  cursor: CXCursor | Uint8Array,
  kind: CXCursorKind,
): Uint8Array | undefined {
  const children = visitChildren(cursor, () => {
    return CXChildVisitResult.Continue;
  });

  return children.find((buffer) => {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      CX_CURSOR_SIZE,
    );
    const cursorKind = view.getUint32(0, true);
    return cursorKind === kind;
  });
}

/**
 * Find a child cursor by kind and spelling
 *
 * @param cursor - The parent cursor
 * @param kind - The cursor kind to find
 * @param spelling - The expected spelling
 * @returns The cursor buffer if found, undefined otherwise
 */
export function findChildByKindAndSpelling(
  cursor: CXCursor | Uint8Array,
  kind: CXCursorKind,
  spelling: string,
): Uint8Array | undefined {
  const children = visitChildren(cursor, () => {
    return CXChildVisitResult.Continue;
  });

  return children.find((buffer) => {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      CX_CURSOR_SIZE,
    );
    const cursorKind = view.getUint32(0, true);
    if (cursorKind !== kind) return false;

    // Get spelling from buffer
    const childSpelling = getCursorSpellingFromBuffer(buffer);
    return childSpelling === spelling;
  });
}

/**
 * Find cursor buffers by kind from an array of child buffers
 */
export function findChildrenByKind(
  children: Uint8Array[],
  kind: CXCursorKind,
): Uint8Array[] {
  return children.filter((buffer) => {
    const view = new DataView(buffer.buffer, buffer.byteOffset, CX_CURSOR_SIZE);
    return view.getUint32(0, true) === kind;
  });
}

/**
 * Deep search: find a descendant cursor matching a predicate
 *
 * @param cursor - The parent cursor to search from
 * @param predicate - Function that takes a cursor buffer and returns true if it matches
 * @returns The cursor buffer if found, undefined otherwise
 */
export function findDescendant(
  cursor: CXCursor | Uint8Array,
  predicate: (buffer: Uint8Array) => boolean,
): Uint8Array | undefined {
  const children = visitChildren(cursor, () => {
    return CXChildVisitResult.Continue;
  });

  for (const buffer of children) {
    if (predicate(buffer)) {
      return buffer;
    }
    // Recurse into children
    const found = findDescendant(buffer, predicate);
    if (found) return found;
  }

  return undefined;
}

/**
 * Find all struct field declarations
 *
 * @param structCursor - A StructDecl cursor
 * @returns Array of FieldDecl cursor buffers
 */
export function findStructFields(
  structCursor: CXCursor | Uint8Array,
): Uint8Array[] {
  const children = visitChildren(structCursor, () => {
    return CXChildVisitResult.Continue;
  });

  return children.filter((buffer) => {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      CX_CURSOR_SIZE,
    );
    return view.getUint32(0, true) === CXCursorKind.FieldDecl;
  });
}

/**
 * Find all enum constant declarations
 *
 * @param enumCursor - An EnumDecl cursor
 * @returns Array of EnumConstantDecl cursor buffers
 */
export function findEnumConstants(
  enumCursor: CXCursor | Uint8Array,
): Uint8Array[] {
  const children = visitChildren(enumCursor, () => {
    return CXChildVisitResult.Continue;
  });

  return children.filter((buffer) => {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      CX_CURSOR_SIZE,
    );
    return view.getUint32(0, true) === CXCursorKind.EnumConstantDecl;
  });
}

/**
 * Find all function parameters
 *
 * @param funcCursor - A FunctionDecl cursor
 * @returns Array of ParmDecl cursor buffers
 */
export function findFunctionParams(
  funcCursor: CXCursor | Uint8Array,
): Uint8Array[] {
  const children = visitChildren(funcCursor, () => {
    return CXChildVisitResult.Continue;
  });

  return children.filter((buffer) => {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      CX_CURSOR_SIZE,
    );
    return view.getUint32(0, true) === CXCursorKind.ParmDecl;
  });
}

/**
 * Parse code and return translation unit, index, and temp file path.
 * Caller is responsible for cleanup.
 */
export async function parseCode(code: string): Promise<{
  index: ReturnType<typeof createIndex>;
  translationUnit: ReturnType<typeof parseTranslationUnit>["translationUnit"];
  file: string;
}> {
  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, code);

  const result = parseTranslationUnit(index, file);
  assertExists(result.translationUnit);

  return {
    index,
    translationUnit: result.translationUnit,
    file,
  };
}

/**
 * Cleanup resources from parseCode
 */
export async function cleanupParseCode(
  index: ReturnType<typeof createIndex>,
  translationUnit: ReturnType<typeof parseTranslationUnit>["translationUnit"],
  file: string,
): Promise<void> {
  if (translationUnit) {
    disposeTranslationUnit(translationUnit);
  }
  disposeIndex(index);
  await Deno.remove(file);
  unload();
}

/**
 * Find a cursor of a specific kind from the translation unit's children
 */
export function findCursorByKind(
  tuCursor: CXCursor | Uint8Array,
  kind: CXCursorKind,
): Uint8Array | undefined {
  const children = visitChildren(tuCursor, () => {
    return CXChildVisitResult.Continue;
  });

  return children.find((buffer) => {
    const view = new DataView(buffer.buffer, buffer.byteOffset, CX_CURSOR_SIZE);
    const cursorKind = view.getUint32(0, true);
    return cursorKind === kind;
  });
}

/**
 * Get the translation unit cursor and find a child cursor by kind in one step
 */
export async function getCursorByKind(
  code: string,
  kind: CXCursorKind,
): Promise<Uint8Array | undefined> {
  const { index, translationUnit, file } = await parseCode(code);

  try {
    const tuCursor = getTranslationUnitCursor(translationUnit);
    return findCursorByKind(tuCursor, kind);
  } finally {
    await cleanupParseCode(index, translationUnit, file);
  }
}

/**
 * Parse code and find a cursor by kind with auto-cleanup.
 * Convenience wrapper around parseC and findCursorByKind.
 */
export async function findCursor(
  code: string,
  kind: CXCursorKind,
): Promise<Uint8Array | undefined> {
  const { tuCursor, cleanup } = await parseC(code);

  try {
    return findCursorByKind(tuCursor, kind);
  } finally {
    await cleanup();
  }
}
