/**
 * Tests for CXErrorCode and error handling
 */

import { assertEquals } from "@std/assert";
import {
  createIndex,
  CXErrorCode,
  disposeIndex,
  disposeTranslationUnit,
  load,
  parseTranslationUnit,
  unload,
} from "../mod.ts";

Deno.test({
  name: "error code - CXErrorCode enum values",
  fn() {
    load();

    // Test CXErrorCode enum values
    assertEquals(CXErrorCode.Success, 0);
    assertEquals(CXErrorCode.Failure, 1);
    assertEquals(CXErrorCode.Crashed, 2);
    assertEquals(CXErrorCode.InvalidArguments, 3);
    assertEquals(CXErrorCode.ASTReadError, 4);

    unload();
  },
});

Deno.test({
  name: "error handling - parse with invalid file",
  fn() {
    load();

    const index = createIndex();

    try {
      // Try to parse a non-existent file
      const result = parseTranslationUnit(index, "/nonexistent/file.c");

      // Should return null translation unit on failure
      assertEquals(result.translationUnit, null);

      disposeIndex(index);
    } finally {
      unload();
    }
  },
});

Deno.test({
  name: "error handling - parse with syntax error",
  async fn() {
    load();

    const index = createIndex();
    // C code with syntax error
    const code = `int x = ;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      // Parse with detailed preprocessing record flag
      const result = parseTranslationUnit(index, file, [
        "-Xclang",
        "-detailed-preprocessing-record",
      ]);

      // Should have a translation unit even with errors
      // (libclang creates TU but with diagnostics)
      assertEquals(result.translationUnit !== null, true);

      // Clean up
      if (result.translationUnit) {
        disposeTranslationUnit(result.translationUnit);
      }
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});
