/**
 * Tests for library load/unload operations
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
} from "../mod.ts";

Deno.test({
  name: "library - load and get symbols",
  fn() {
    // Load the library
    load();

    // Verify we can create index after load
    const index = createIndex();
    assertExists(index);

    // Verify we can parse a translation unit
    const file = Deno.makeTempFileSync?.({ suffix: ".c" });
    if (file) {
      Deno.writeTextFileSync(file, `int x = 5;`);
      try {
        const result = parseTranslationUnit(index, file);
        assertExists(result.translationUnit);

        // Verify we can get cursor from translation unit
        const cursor = getTranslationUnitCursor(result.translationUnit);
        assertExists(cursor);

        disposeTranslationUnit(result.translationUnit);
      } finally {
        Deno.removeSync(file);
      }
    }

    disposeIndex(index);
    unload();
  },
});

Deno.test({
  name: "library - unload and reload",
  fn() {
    // First load
    load();
    let index = createIndex();
    assertExists(index);
    disposeIndex(index);
    unload();

    // Reload
    load();
    index = createIndex();
    assertExists(index);
    disposeIndex(index);
    unload();
  },
});

Deno.test({
  name: "library - load with auto-detection",
  fn() {
    // Auto-detect and load libclang
    load();

    // Verify library is loaded by creating index
    const index = createIndex();
    assertExists(index);

    // Parse a simple file to verify libclang works
    const file = Deno.makeTempFileSync?.({ suffix: ".c" });
    if (file) {
      Deno.writeTextFileSync(file, `int main() { return 0; }`);
      try {
        const result = parseTranslationUnit(index, file);
        assertExists(result.translationUnit);
        disposeTranslationUnit(result.translationUnit);
      } finally {
        Deno.removeSync(file);
      }
    }

    disposeIndex(index);
    unload();
  },
});

Deno.test({
  name: "library - multiple load calls are idempotent",
  fn() {
    // Multiple load calls should not throw
    load();
    load();
    load();

    // Library should work
    const index = createIndex();
    assertExists(index);
    disposeIndex(index);

    unload();
  },
});
