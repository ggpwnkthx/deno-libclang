/**
 * Tests for reparseTranslationUnit operations
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
  name: "reparse - basic reparse with file changes",
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

      // Get cursor kind before reparse
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

Deno.test({
  name: "reparse - reparse with syntax error changes",
  async fn() {
    load();

    const index = createIndex();
    const code1 = `int x = 5;`; // valid
    const code2 = `int x = ;`; // invalid - missing rvalue

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code1);

    try {
      // Parse valid code
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Initially no errors
      const numDiags1 = getNumDiagnostics(result.translationUnit);
      assertEquals(numDiags1, 0);

      // Modify file to have syntax error
      await Deno.writeTextFile(file, code2);

      // Reparse
      const reparseResult = reparseTranslationUnit(result.translationUnit);
      assertEquals(reparseResult, 0);

      // Should now have diagnostics
      const numDiags2 = getNumDiagnostics(result.translationUnit);
      assertEquals(numDiags2 > 0, true);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "reparse - reparse with function addition",
  async fn() {
    load();

    const index = createIndex();
    const code1 = `int x = 5;`;
    const code2 = `int x = 5;\nint foo() { return 42; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code1);

    try {
      // Parse initial version
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Modify file with new function
      await Deno.writeTextFile(file, code2);

      // Reparse the translation unit
      const reparseResult = reparseTranslationUnit(result.translationUnit);
      assertEquals(reparseResult, 0);

      // Verify translation unit is still valid
      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const kind = getCursorKind(tuCursor);
      assertEquals(kind, CXCursorKind.TranslationUnit);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "reparse - multiple successive reparses",
  async fn() {
    load();

    const index = createIndex();

    const file = await Deno.makeTempFile({ suffix: ".c" });

    try {
      // Start with initial code
      await Deno.writeTextFile(file, `int x = 1;`);
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // First reparse
      await Deno.writeTextFile(file, `int x = 2;`);
      let reparseResult = reparseTranslationUnit(result.translationUnit);
      assertEquals(reparseResult, 0);

      // Second reparse
      await Deno.writeTextFile(file, `int x = 3;`);
      reparseResult = reparseTranslationUnit(result.translationUnit);
      assertEquals(reparseResult, 0);

      // Third reparse
      await Deno.writeTextFile(file, `int x = 4;`);
      reparseResult = reparseTranslationUnit(result.translationUnit);
      assertEquals(reparseResult, 0);

      // Verify translation unit is still valid
      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const kind = getCursorKind(tuCursor);
      assertEquals(kind, CXCursorKind.TranslationUnit);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});
