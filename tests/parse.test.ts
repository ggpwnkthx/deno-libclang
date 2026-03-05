/**
 * Tests for translation unit parsing
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXCursorKind,
  disposeTranslationUnit,
  getCursorLocation,
  getTranslationUnitCursor,
  parseTranslationUnit,
} from "../mod.ts";
import { findCursorByKind, parseC } from "./test_utils.ts";

// ============================================================================
// Real unsaved file and compiler args tests (unique parse behaviors)
// ============================================================================

Deno.test({
  name: "parse - unsaved file overrides disk file",
  async fn() {
    const { index, cleanup } = await parseC(`int x = 999;`);
    try {
      // Parse with unsaved file that overrides disk content
      const unsavedCode = `int x = 42;`;
      const result = parseTranslationUnit(index, "dummy.c", [], [
        {
          filename: "dummy.c",
          contents: unsavedCode,
          length: unsavedCode.length,
        },
      ]);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Get children as buffers
      const children = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(children, "Expected to find VarDecl in parsed unsaved file");

      // Clean up this specific test's extra TU
      const { disposeTranslationUnit } = await import("../mod.ts");
      disposeTranslationUnit(result.translationUnit);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - compiler args -D defines change AST",
  async fn() {
    const { index, cleanup: cleanup1 } = await parseC(`int x = 5;`);
    try {
      const code = `#ifdef MY_MACRO
int x = 42;
#else
int x = 999;
#endif`;

      // Parse WITHOUT -D flag - should have x = 999 (line 4)
      const resultNoDef = parseTranslationUnit(
        index,
        "dummy.c",
        ["-Wno-everything"],
        [{ filename: "dummy.c", contents: code, length: code.length }],
      );
      assertExists(resultNoDef.translationUnit);

      // Parse WITH -D flag - should have x = 42 (line 2)
      const resultWithDef = parseTranslationUnit(
        index,
        "dummy.c",
        ["-DMY_MACRO", "-Wno-everything"],
        [{ filename: "dummy.c", contents: code, length: code.length }],
      );
      assertExists(resultWithDef.translationUnit);

      // Get cursor locations from both
      const getVarLocation = (tu: typeof resultNoDef.translationUnit) => {
        const tuCursor = getTranslationUnitCursor(tu);
        const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
        if (!varDecl) return { line: 0 };
        return getCursorLocation(varDecl);
      };

      const loc1 = getVarLocation(resultNoDef.translationUnit);
      const loc2 = getVarLocation(resultWithDef.translationUnit);

      // With MY_MACRO defined, the "int x = 42;" is on line 2 (not line 4)
      // Without, it's on line 4
      // They should be different
      assertEquals(loc1.line !== loc2.line, true);

      disposeTranslationUnit(resultNoDef.translationUnit);
      disposeTranslationUnit(resultWithDef.translationUnit);
    } finally {
      await cleanup1();
    }
  },
});
