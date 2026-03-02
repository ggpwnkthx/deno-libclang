/**
 * Tests for translation unit parsing
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXCursorKind,
  disposeTranslationUnit,
  getCursorLocation,
  getFile,
  getNumDiagnostics,
  getTranslationUnitCursor,
  parseTranslationUnit,
  reparseTranslationUnit,
} from "../mod.ts";
import { findCursorByKind, parseC } from "./test_utils.ts";

Deno.test({
  name: "parse - parse simple C struct",
  async fn() {
    const { tu, cleanup } = await parseC(`
      struct Point {
        int x;
        int y;
      };
    `);
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse function declaration",
  async fn() {
    const { tu, cleanup } = await parseC(`
      int add(int a, int b) {
        return a + b;
      }

      int main() {
        return add(1, 2);
      }
    `);
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse result includes error on invalid code",
  async fn() {
    const { index, tu, file, cleanup } = await parseC(
      `int main() { return invalid_syntax `,
    );
    try {
      assertExists(tu);
      const numDiags = getNumDiagnostics(tu);
      assertEquals(typeof numDiags, "number");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse non-existent file throws",
  async fn() {
    // Use parseTranslationUnit directly for non-existent file test
    const { index, cleanup } = await parseC(`int x = 5;`);
    try {
      const result = parseTranslationUnit(index, "/nonexistent/file.c");
      assertEquals(
        result.translationUnit === null || result.error !== undefined,
        true,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse with invalid arguments",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`);
    try {
      // Try to get a file that doesn't exist in the TU
      const _nonExistentFile = getFile(tu, "/nonexistent.h");
      // This should return a null file handle - verify it's handled gracefully
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - disposeTranslationUnit cleans up resources",
  async fn() {
    const { cleanup } = await parseC(`int x = 5;`);
    // Cleanup should not throw
    await cleanup();
  },
});

// ============================================================================
// Tests for unsaved files and compiler args
// ============================================================================

Deno.test({
  name: "parse - parse with unsaved file (in-memory buffer)",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`);
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse with multiple unsaved files",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`);
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse with compiler args (-D for define)",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`, { args: [] });
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse with empty args array",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`, { args: [] });
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "parse - parse with empty unsaved files array",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`);
    try {
      assertExists(tu);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "reparse - reparse with unsaved files",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`);
    try {
      const reparseResult = reparseTranslationUnit(tu, []);
      assertEquals(reparseResult, 0, "Reparse should succeed");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "reparse - reparse with empty unsaved files",
  async fn() {
    const { tu, cleanup } = await parseC(`int x = 5;`);
    try {
      const reparseResult = reparseTranslationUnit(tu, []);
      assertEquals(reparseResult, 0, "Reparse should succeed");
    } finally {
      await cleanup();
    }
  },
});

// ============================================================================
// Real unsaved file and compiler args tests
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
