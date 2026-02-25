/**
 * Shared test utilities for libclang tests
 */

import { assertExists } from "@std/assert";
import {
  createIndex,
  disposeIndex,
  disposeTranslationUnit,
  getTranslationUnitCursor,
  load,
  parseTranslationUnit,
  unload,
  visitChildren,
} from "../mod.ts";
import { CXChildVisitResult, type CXCursorKind } from "../mod.ts";
import type { CXCursor } from "../src/ffi/types.ts";

/**
 * Load the libclang library. Should be called at the start of each test.
 */
export function setupLib(): void {
  load();
}

/**
 * Unload the libclang library. Should be called at the end of each test.
 */
export function teardownLib(): void {
  unload();
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
    const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
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
