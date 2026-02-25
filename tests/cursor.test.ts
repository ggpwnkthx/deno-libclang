/**
 * Tests for cursor operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createIndex,
  CXChildVisitResult,
  CXCursorKind,
  disposeIndex,
  disposeTranslationUnit,
  getCursorAvailability,
  getCursorDefinition,
  getCursorDisplayName,
  getCursorExtent,
  getCursorKind,
  getCursorKindSpelling,
  getCursorLocation,
  getCursorReferenced,
  getCursorSpelling,
  getCursorSpellingFromBuffer,
  getCursorUSR,
  getEnumConstantDeclUnsignedValue,
  getEnumConstantDeclValue,
  getTranslationUnitCursor,
  load,
  parseTranslationUnit,
  unload,
  visitChildren,
} from "../mod.ts";

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
  name: "cursor - getCursorLocation",
  async fn() {
    load();

    const index = createIndex();
    const code = `int main() { return 0; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find FunctionDecl cursor
      const funcDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.FunctionDecl;
      });

      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Get cursor location
      const location = getCursorLocation(funcDecl);
      assertExists(location);
      assertEquals(typeof location.line, "number");
      assertEquals(typeof location.column, "number");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorExtent",
  async fn() {
    load();

    const index = createIndex();
    const code = `int main() { return 0; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find FunctionDecl cursor
      const funcDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.FunctionDecl;
      });

      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Get cursor extent
      const extent = getCursorExtent(funcDecl);
      assertExists(extent);
      assertExists(extent.start);
      assertExists(extent.end);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorAvailability",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x = 5;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find VarDecl cursor
      const varDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.VarDecl;
      });

      assertExists(varDecl, "Expected to find VarDecl cursor");

      // Get cursor availability - should be 0 (Available)
      const availability = getCursorAvailability(varDecl);
      assertEquals(availability, 0);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorReferenced",
  async fn() {
    load();

    const index = createIndex();
    // Variable reference: global is used in main
    const code = `
      int global = 10;
      int main() { return global; }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find the reference to 'global' in main (DeclRefExpr)
      // This test checks the function is callable
      const funcDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.FunctionDecl;
      });

      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Try getCursorReferenced - may return null cursor if no reference
      const referenced = getCursorReferenced(funcDecl);
      // Just verify it doesn't throw and returns something
      assertExists(referenced);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorDefinition",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      int global = 10;
      int main() { return global; }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find VarDecl for global
      const varDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.VarDecl;
      });

      assertExists(varDecl, "Expected to find VarDecl cursor");

      // Get cursor definition
      const definition = getCursorDefinition(varDecl);
      // Should return something (the cursor itself for a definition)
      assertExists(definition);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getEnumConstantDeclValue (signed)",
  async fn() {
    load();

    const index = createIndex();
    // Use enum in a way that actually creates enum constant declarations
    const code = `
      enum Color { RED = -5, GREEN, BLUE };
      int main() { return RED; }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Test that getEnumConstantDeclValue can be called on a valid buffer
      // Create a mock buffer that represents an enum constant cursor
      const mockBuffer = new Uint8Array(32);
      const view = new DataView(mockBuffer.buffer);
      view.setUint32(0, CXCursorKind.EnumConstantDecl, true);

      // The function should be callable and return a bigint (may be 0n for invalid cursor)
      const value = getEnumConstantDeclValue(mockBuffer);
      assertEquals(typeof value, "bigint");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getEnumConstantDeclUnsignedValue",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      enum Color { RED = 0, GREEN = 1, BLUE = 2 };
      int main() { return RED; }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Test that getEnumConstantDeclUnsignedValue can be called on a buffer
      const mockBuffer = new Uint8Array(32);
      const view = new DataView(mockBuffer.buffer);
      view.setUint32(0, CXCursorKind.EnumConstantDecl, true);

      // The function should be callable and return a bigint
      const unsignedValue = getEnumConstantDeclUnsignedValue(mockBuffer);
      assertEquals(typeof unsignedValue, "bigint");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorUSR",
  async fn() {
    load();

    const index = createIndex();
    const code = `struct Point { int x; int y; };`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find StructDecl cursor
      const structDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.StructDecl;
      });

      assertExists(structDecl, "Expected to find StructDecl cursor");

      // Get USR - should be a non-empty string
      const usr = getCursorUSR(structDecl);
      assertEquals(typeof usr, "string");
      // USR should contain some identifier for the struct
      assertEquals(usr.length > 0, true);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorSpellingFromBuffer",
  async fn() {
    load();

    const index = createIndex();
    const code = `int my_function(void);`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Find FunctionDecl cursor
      const funcDecl = children.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.FunctionDecl;
      });

      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Get spelling from buffer
      const spelling = getCursorSpellingFromBuffer(funcDecl);
      assertEquals(spelling, "my_function");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

// Helper function
function assertStringIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected "${actual}" to include "${expected}"`);
  }
}

// ============================================================================
// visitChildren Tests
// ============================================================================

Deno.test({
  name: "cursor - visitChildren basic traversal",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      struct Point { int x; int y; };
      int main() { return 0; }
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Visit children and collect all
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Should have found at least StructDecl and FunctionDecl
      assertExists(children);
      assertEquals(children.length >= 2, true);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren returns Continue",
  async fn() {
    load();

    const index = createIndex();
    const code = `int a = 1; int b = 2; int c = 3;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Using Continue should visit all children
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Should find all 3 VarDecl
      const varDecls = children.filter((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.VarDecl;
      });

      assertEquals(varDecls.length, 3);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren returns Break",
  async fn() {
    load();

    const index = createIndex();
    const code = `int a = 1; int b = 2; int c = 3;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // Using Break should stop after first child
      let visitCount = 0;
      const children = visitChildren(tuCursor, () => {
        visitCount++;
        return CXChildVisitResult.Break;
      });

      // Should only visit 1 child then break
      assertEquals(visitCount, 1);
      assertEquals(children.length, 1);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren traverses different cursor kinds",
  async fn() {
    load();

    const index = createIndex();
    const code = `
      struct Point { int x; int y; };
      enum Color { RED, GREEN, BLUE };
      int add(int a, int b) { return a + b; }
      int global_var = 10;
    `;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Check we found different cursor kinds
      const kinds = new Set<number>();
      for (const buffer of children) {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        kinds.add(kind);
      }

      // Should have at least StructDecl, EnumDecl, FunctionDecl, VarDecl
      assertEquals(kinds.has(CXCursorKind.StructDecl), true);
      assertEquals(kinds.has(CXCursorKind.FunctionDecl), true);
      assertEquals(kinds.has(CXCursorKind.VarDecl), true);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with struct fields",
  async fn() {
    load();

    const index = createIndex();
    const code = `struct Point { int x; int y; };`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // First get the struct declaration
      const topLevelChildren = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      const structDecl = topLevelChildren.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.StructDecl;
      });

      assertExists(structDecl, "Expected to find StructDecl cursor");

      // Now visit children of the struct to find fields
      const structChildren = visitChildren(structDecl, () => {
        return CXChildVisitResult.Continue;
      });

      // Should have 2 FieldDecl (x and y)
      const fieldDecls = structChildren.filter((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.FieldDecl;
      });

      assertEquals(fieldDecls.length, 2);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with enum values",
  async fn() {
    load();

    const index = createIndex();
    const code = `enum Color { RED, GREEN, BLUE };`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // First get the enum declaration
      const topLevelChildren = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      const enumDecl = topLevelChildren.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.EnumDecl;
      });

      assertExists(enumDecl, "Expected to find EnumDecl cursor");

      // Now visit children of the enum to find enum constants
      const enumChildren = visitChildren(enumDecl, () => {
        return CXChildVisitResult.Continue;
      });

      // Should have 3 EnumConstantDecl (RED, GREEN, BLUE)
      const enumConstants = enumChildren.filter((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.EnumConstantDecl;
      });

      assertEquals(enumConstants.length, 3);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with function parameters",
  async fn() {
    load();

    const index = createIndex();
    const code = `int add(int a, int b, int c);`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const tuCursor = getTranslationUnitCursor(result.translationUnit);

      // First get the function declaration
      const topLevelChildren = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      const funcDecl = topLevelChildren.find((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.FunctionDecl;
      });

      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Now visit children of the function to find parameters
      const funcChildren = visitChildren(funcDecl, () => {
        return CXChildVisitResult.Continue;
      });

      // Should have 3 ParmDecl
      const parmDecls = funcChildren.filter((buffer) => {
        const view = new DataView(buffer.buffer, buffer.byteOffset, 40);
        const kind = view.getUint32(0, true);
        return kind === CXCursorKind.ParmDecl;
      });

      assertEquals(parmDecls.length, 3);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});
