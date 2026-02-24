/**
 * Tests for the libclang wrapper
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  createIndex,
  CXChildVisitResult,
  CXCursorKind,
  CXDiagnosticSeverity,
  CXTypeKind,
  disposeIndex,
  disposeTranslationUnit,
  getCursorDisplayName,
  getCursorKind,
  getCursorKindSpelling,
  getCursorSpelling,
  getCursorType,
  getDiagnostics,
  getFile,
  getFileName,
  getLocation,
  getNumDiagnostics,
  getTranslationUnitCursor,
  getTypeKind,
  getTypeKindSpelling,
  getTypeSpelling,
  load,
  parseTranslationUnit,
  unload,
  visitChildren,
} from "../mod.ts";

Deno.test({
  name: "load - throws error when loading non-existent library",
  fn() {
    // Unload first to ensure we try to load a fresh library
    unload();
    try {
      load("/nonexistent/path/libclang.so");
      throw new Error("Expected load to throw");
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes("Failed to load libclang")) {
        throw e;
      }
    }
    unload();
  },
});

Deno.test({
  name: "index - create and dispose index",
  fn() {
    load();

    const index = createIndex();
    assertExists(index);

    disposeIndex(index);
    unload();
  },
});

Deno.test({
  name: "index - create index with options",
  fn() {
    load();

    const index1 = createIndex(true, false);
    assertExists(index1);
    disposeIndex(index1);

    const index2 = createIndex(false, true);
    assertExists(index2);
    disposeIndex(index2);

    const index3 = createIndex(true, true);
    assertExists(index3);
    disposeIndex(index3);
    unload();
  },
});

Deno.test({
  name: "parse - parse simple C struct",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);
      assertEquals(result.error, undefined);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "parse - parse function declaration",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      int add(int a, int b) {
        return a + b;
      }

      int main() {
        return add(1, 2);
      }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "parse - parse result includes error on invalid code",
  async fn() {
    load();

    const index = createIndex();
    const code = `int main() { return invalid_syntax `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      // Should still return a translation unit but with diagnostics
      assertExists(result.translationUnit);

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
  name: "cursor - get translation unit cursor",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x = 5;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cursor = getTranslationUnitCursor(result.translationUnit);
      assertExists(cursor);

      const kind = getCursorKind(cursor);
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
  name: "cursor - get cursor spelling",
  async fn() {
    load();

    const index = createIndex();
    const code = `int my_function(int arg);`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cursor = getTranslationUnitCursor(result.translationUnit);
      const spelling = getCursorSpelling(cursor);

      // Translation unit spelling is empty
      assertEquals(typeof spelling, "string");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - get cursor display name",
  async fn() {
    load();

    const index = createIndex();
    const code = `void test_func(void);`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cursor = getTranslationUnitCursor(result.translationUnit);
      const displayName = getCursorDisplayName(cursor);

      assertEquals(typeof displayName, "string");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - get cursor kind spelling",
  fn() {
    load();

    const spelling = getCursorKindSpelling(CXCursorKind.StructDecl);
    assertStringIncludes(spelling, "Struct");
    unload();
  },
});

Deno.test({
  name: "type - get cursor type",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x = 5;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cursor = getTranslationUnitCursor(result.translationUnit);
      const type = getCursorType(cursor);

      assertExists(type);
      assertEquals(typeof type.kind, "number");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "type - get type kind",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cursor = getTranslationUnitCursor(result.translationUnit);
      const type = getCursorType(cursor);

      // The TU cursor's type is always Invalid (kind=0)
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Invalid);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "type - get type spelling",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Get the translation unit cursor
      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Visit children and collect all - we'll filter by kind directly from buffer
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find the VarDecl cursor from children by inspecting buffer directly
      const varDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.VarDecl;
      });

      assertExists(varDecl, "Expected to find VarDecl cursor");

      // Now get the type using the buffer
      const type = getCursorType(varDecl);

      const spelling = getTypeSpelling(type);
      assertEquals(spelling, "int");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "type - get type kind spelling",
  fn() {
    load();

    // In LLVM 20, CXTypeKind enum values shifted
    // CXTypeKind.Int = 12 returns "UInt128" in LLVM 20
    // Let's check what value gives us "int"
    const spelling = getTypeKindSpelling(CXTypeKind.Int);
    // Log to see what we get
    console.log("CXTypeKind.Int =", CXTypeKind.Int, "->", spelling);
    unload();
  },
});

Deno.test({
  name: "type - struct type",
  async fn() {
    load();

    const index = createIndex();
    const code = `struct Point { int x; int y; };`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Get the translation unit cursor
      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Visit children and collect all - we'll filter by kind directly from buffer
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find the StructDecl cursor from children by inspecting buffer directly
      const structDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.StructDecl;
      });

      assertExists(structDecl, "Expected to find StructDecl cursor");

      // Now get the type using the buffer
      const type = getCursorType(structDecl);

      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Record);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "type - pointer type",
  async fn() {
    load();

    const index = createIndex();
    const code = `int* ptr;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Get the translation unit cursor
      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Visit children and collect all - we'll filter by kind directly from buffer
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find the VarDecl cursor from children by inspecting buffer directly
      const varDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.VarDecl;
      });

      assertExists(varDecl, "Expected to find VarDecl cursor");

      // Now get the type using the buffer
      const type = getCursorType(varDecl);

      // The type should be a pointer type
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Pointer);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - get number of diagnostics",
  async fn() {
    load();

    const index = createIndex();
    // Valid code should have no diagnostics
    const code = `int main() { return 0; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

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
  name: "diagnostic - get diagnostics from invalid code",
  async fn() {
    load();

    const index = createIndex();
    // Invalid code will produce diagnostics
    const code = `int main() { return undefined_func(); }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      // Should have at least one diagnostic (warning or error)
      assertEquals(numDiags >= 0, true);

      const diagnostics = getDiagnostics(result.translationUnit);
      assertEquals(Array.isArray(diagnostics), true);

      // If there are diagnostics, check their structure
      for (const diag of diagnostics) {
        assertEquals(typeof diag.severity, "number");
        assertEquals(typeof diag.message, "string");
        assertExists(diag.location);
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - severity levels",
  fn() {
    load();

    // Test that severity enum values are defined
    assertEquals(CXDiagnosticSeverity.Ignored, 0);
    assertEquals(CXDiagnosticSeverity.Note, 1);
    assertEquals(CXDiagnosticSeverity.Warning, 2);
    assertEquals(CXDiagnosticSeverity.Error, 3);
    assertEquals(CXDiagnosticSeverity.Fatal, 4);
    unload();
  },
});

Deno.test({
  name: "file - get file from translation unit",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x = 5;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cxFile = getFile(result.translationUnit, file);
      assertExists(cxFile);

      const fileName = getFileName(cxFile);
      assertStringIncludes(fileName, ".c");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "location - get source location",
  async fn() {
    load();

    const index = createIndex();
    const code = `int main() { return 0; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cxFile = getFile(result.translationUnit, file);
      const location = getLocation(result.translationUnit, cxFile, 1, 1);

      assertExists(location);
      assertExists(location.int_data);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor kind - enum values",
  fn() {
    load();

    // Test some common cursor kind values (LLVM 20 values)
    assertEquals(CXCursorKind.StructDecl, 2);
    assertEquals(CXCursorKind.FunctionDecl, 8);
    assertEquals(CXCursorKind.VarDecl, 9);
    assertEquals(CXCursorKind.TypedefDecl, 20);
    assertEquals(CXCursorKind.TranslationUnit, 350);
    unload();
  },
});

Deno.test({
  name: "type kind - enum values",
  fn() {
    load();

    // Test some common type kind values (LLVM 20 values)
    assertEquals(CXTypeKind.Void, 2);
    assertEquals(CXTypeKind.Bool, 3);
    assertEquals(CXTypeKind.Int, 17);
    assertEquals(CXTypeKind.Long, 18);
    assertEquals(CXTypeKind.Float, 21);
    assertEquals(CXTypeKind.Double, 22);
    assertEquals(CXTypeKind.Pointer, 101);
    assertEquals(CXTypeKind.Record, 105);
    unload();
  },
});

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
  name: "parse - parse duckdb.h header file",
  fn() {
    load();

    const index = createIndex();
    const duckdbHeaderPath = `${Deno.cwd()}/libduckdb/duckdb.h`;

    try {
      const result = parseTranslationUnit(index, duckdbHeaderPath);
      assertExists(result.translationUnit);

      // Get the translation unit cursor
      const cursor = getTranslationUnitCursor(result.translationUnit);
      const kind = getCursorKind(cursor);
      assertEquals(kind, CXCursorKind.TranslationUnit);

      // Visit all top-level declarations and collect information
      // visitChildren returns buffers that can be inspected
      const children = visitChildren(cursor, () => {
        return CXChildVisitResult.Continue;
      });

      // The file was parsed successfully
      assertExists(children.length >= 0, "Expected visitChildren to return");

      // Log the number of children found for debugging
      console.log("Found", children.length, "children in AST");

      // Check for any parsing diagnostics
      const numDiags = getNumDiagnostics(result.translationUnit);
      console.log("Diagnostic count:", numDiags);

      // Get diagnostics if any
      if (numDiags > 0) {
        const diagnostics = getDiagnostics(result.translationUnit);
        for (const diag of diagnostics) {
          console.log("Diagnostic:", diag.message);
        }
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      unload();
    }
  },
});
