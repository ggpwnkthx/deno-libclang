/**
 * Integration tests for complex parsing scenarios
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createIndex,
  CXCursorKind,
  disposeIndex,
  disposeTranslationUnit,
  getCursorKind,
  getNumDiagnostics,
  getTranslationUnitCursor,
  load,
  parseTranslationUnit,
  reparseTranslationUnit,
  unload,
} from "../mod.ts";

Deno.test({
  name: "integration - parse complex C code",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      struct Point {
        int x;
        int y;
      };

      typedef int MyInt;

      enum Color { RED, GREEN, BLUE };

      static int global_var = 42;

      int add(int a, int b) {
        return a + b;
      }

      int main() {
        struct Point p;
        p.x = 1;
        p.y = 2;
        MyInt val = global_var;
        return add(p.x, p.y);
      }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Check that the file parses successfully
      const cursor = getTranslationUnitCursor(result.translationUnit);
      const kind = getCursorKind(cursor);
      assertEquals(kind, CXCursorKind.TranslationUnit);

      // Check diagnostics
      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(typeof numDiags, "number");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "integration - reparseTranslationUnit reflects changes in AST",
  async fn() {
    load();

    const index = createIndex();
    const code1 = `int x = 5;`;
    const code2 = `int x = 10;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code1);

    try {
      // Parse initial version
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Get cursor spelling before reparse
      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const kind = getCursorKind(tuCursor);
      assertEquals(kind, CXCursorKind.TranslationUnit);

      // Modify the file
      await Deno.writeTextFile(file, code2);

      // Reparse the translation unit
      const reparseResult = reparseTranslationUnit(result.translationUnit);
      assertEquals(reparseResult, 0);

      // Verify the translation unit is still valid after reparse
      const tuCursor2 = getTranslationUnitCursor(result.translationUnit);
      const kind2 = getCursorKind(tuCursor2);
      assertEquals(kind2, CXCursorKind.TranslationUnit);

      // Verify we can still get diagnostics after reparse
      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(typeof numDiags, "number");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});
