/**
 * Tests for cursor operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXChildVisitResult,
  CXCursorKind,
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
  load,
  unload,
  visitChildren,
} from "../mod.ts";
import {
  assertStringIncludes,
  findChildByKind,
  findChildrenByKind,
  findCursorByKind,
  findEnumConstants,
  findFunctionParams,
  findStructFields,
  parseC,
} from "./test_utils.ts";

Deno.test({
  name: "cursor - get translation unit cursor",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int x = 5;`);

    try {
      const kind = getCursorKind(tuCursor);
      assertEquals(kind, CXCursorKind.TranslationUnit);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - get cursor spelling",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int my_function(int arg);`);

    try {
      const spelling = getCursorSpelling(tuCursor);
      // Translation unit spelling is empty
      assertEquals(typeof spelling, "string");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - get cursor display name",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`void test_func(void);`);

    try {
      const displayName = getCursorDisplayName(tuCursor);
      assertEquals(typeof displayName, "string");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - get cursor kind spelling",
  fn() {
    load();
    try {
      const spelling = getCursorKindSpelling(CXCursorKind.StructDecl);
      assertStringIncludes(spelling, "Struct");
    } finally {
      unload();
    }
  },
});

Deno.test({
  name: "cursor - getCursorLocation",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int main() { return 0; }`);

    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Get cursor location
      const location = getCursorLocation(funcDecl);
      assertExists(location);
      assertEquals(typeof location.line, "number");
      assertEquals(typeof location.column, "number");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getCursorExtent",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int main() { return 0; }`);

    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Get cursor extent
      const extent = getCursorExtent(funcDecl);
      assertExists(extent);
      assertExists(extent.start);
      assertExists(extent.end);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getCursorAvailability",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int x = 5;`);

    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      // Get cursor availability - should be 0 (Available)
      const availability = getCursorAvailability(varDecl);
      assertEquals(availability, 0);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getCursorReferenced",
  async fn() {
    const code = `
      int global = 10;
      int main() { return global; }
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Try getCursorReferenced - may return null cursor if no reference
      const referenced = getCursorReferenced(funcDecl);
      // Just verify it doesn't throw and returns something
      assertExists(referenced);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getCursorDefinition",
  async fn() {
    const code = `
      int global = 10;
      int main() { return global; }
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      // Get cursor definition
      const definition = getCursorDefinition(varDecl);
      // Should return something (the cursor itself for a definition)
      assertExists(definition);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getEnumConstantDeclValue (signed)",
  async fn() {
    // Use enum with explicit values: RED=-5, GREEN=0, BLUE=2
    const code = `
      enum Color { RED = -5, GREEN = 0, BLUE = 2 };
      int main() { return RED; }
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      // Find the EnumDecl
      const enumDeclBuffer = findChildByKind(tuCursor, CXCursorKind.EnumDecl);
      assertExists(enumDeclBuffer, "Expected to find EnumDecl");

      // Find enum constant children using helper
      const enumConstants = findEnumConstants(enumDeclBuffer);

      // Should have 3 enum constants
      assertEquals(enumConstants.length, 3);

      // Get values for each enum constant
      const redValue = getEnumConstantDeclValue(enumConstants[0]);
      const greenValue = getEnumConstantDeclValue(enumConstants[1]);
      const blueValue = getEnumConstantDeclValue(enumConstants[2]);

      // Verify the values match the enum declaration
      assertEquals(redValue, -5n);
      assertEquals(greenValue, 0n);
      assertEquals(blueValue, 2n);

      // Also verify spelling matches using the buffer-based function
      const redSpelling = getCursorSpellingFromBuffer(enumConstants[0]);
      const greenSpelling = getCursorSpellingFromBuffer(enumConstants[1]);
      const blueSpelling = getCursorSpellingFromBuffer(enumConstants[2]);

      assertEquals(redSpelling, "RED");
      assertEquals(greenSpelling, "GREEN");
      assertEquals(blueSpelling, "BLUE");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getEnumConstantDeclUnsignedValue",
  async fn() {
    // Use unsigned enum values
    const code = `
      enum Color { RED = 0, GREEN = 1, BLUE = 2 };
      int main() { return RED; }
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      // Find the EnumDecl
      const enumDeclBuffer = findChildByKind(tuCursor, CXCursorKind.EnumDecl);
      assertExists(enumDeclBuffer, "Expected to find EnumDecl");

      // Find enum constant children using helper
      const enumConstants = findEnumConstants(enumDeclBuffer);

      // Should have 3 enum constants
      assertEquals(enumConstants.length, 3);

      // Get unsigned values for each enum constant
      const redValue = getEnumConstantDeclUnsignedValue(enumConstants[0]);
      const greenValue = getEnumConstantDeclUnsignedValue(enumConstants[1]);
      const blueValue = getEnumConstantDeclUnsignedValue(enumConstants[2]);

      // Verify the unsigned values
      assertEquals(redValue, 0n);
      assertEquals(greenValue, 1n);
      assertEquals(blueValue, 2n);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getCursorUSR",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `struct Point { int x; int y; };`,
    );

    try {
      const structDecl = findCursorByKind(tuCursor, CXCursorKind.StructDecl);
      assertExists(structDecl, "Expected to find StructDecl cursor");

      // Get USR - should be a non-empty string
      const usr = getCursorUSR(structDecl);
      assertEquals(typeof usr, "string");
      // USR should contain some identifier for the struct
      assertEquals(usr.length > 0, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - getCursorSpellingFromBuffer",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int my_function(void);`);

    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Get spelling from buffer
      const spelling = getCursorSpellingFromBuffer(funcDecl);
      assertEquals(spelling, "my_function");
    } finally {
      await cleanup();
    }
  },
});

// ============================================================================
// visitChildren Tests
// ============================================================================

Deno.test({
  name: "cursor - visitChildren basic traversal",
  async fn() {
    const code = `
      struct Point { int x; int y; };
      int main() { return 0; }
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      // Visit children and collect all
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Should have found at least StructDecl and FunctionDecl
      assertExists(children);
      assertEquals(children.length >= 2, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren returns Continue",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `int a = 1; int b = 2; int c = 3;`,
    );

    try {
      // Using Continue should visit all children
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Continue,
      );

      // Should find all 3 VarDecl
      const varDecls = findChildrenByKind(children, CXCursorKind.VarDecl);
      assertEquals(varDecls.length, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren returns Break",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `int a = 1; int b = 2; int c = 3;`,
    );

    try {
      // Using Break should stop after first child
      let visitCount = 0;
      const children = visitChildren(tuCursor, () => {
        visitCount++;
        return CXChildVisitResult.Break;
      });

      // Should only visit 1 child then break
      assertEquals(visitCount, 1);
      assertEquals(children.length, 1);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren traverses different cursor kinds",
  async fn() {
    const code = `
      struct Point { int x; int y; };
      enum Color { RED, GREEN, BLUE };
      int add(int a, int b) { return a + b; }
      int global_var = 10;
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Continue,
      );

      // Check we found different cursor kinds
      const hasStruct =
        findChildrenByKind(children, CXCursorKind.StructDecl).length > 0;
      const hasEnum =
        findChildrenByKind(children, CXCursorKind.EnumDecl).length > 0;
      const hasFunc =
        findChildrenByKind(children, CXCursorKind.FunctionDecl).length > 0;
      const hasVar =
        findChildrenByKind(children, CXCursorKind.VarDecl).length > 0;

      assertEquals(hasStruct, true);
      assertEquals(hasEnum, true);
      assertEquals(hasFunc, true);
      assertEquals(hasVar, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with struct fields",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `struct Point { int x; int y; };`,
    );

    try {
      // Find the struct declaration
      const structDecl = findCursorByKind(tuCursor, CXCursorKind.StructDecl);
      assertExists(structDecl, "Expected to find StructDecl cursor");

      // Use helper to find fields
      const fieldDecls = findStructFields(structDecl);

      // Should have 2 FieldDecl (x and y)
      assertEquals(fieldDecls.length, 2);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with enum values",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `enum Color { RED, GREEN, BLUE };`,
    );

    try {
      // Find the enum declaration
      const enumDecl = findCursorByKind(tuCursor, CXCursorKind.EnumDecl);
      assertExists(enumDecl, "Expected to find EnumDecl cursor");

      // Use helper to find enum constants
      const enumConstants = findEnumConstants(enumDecl);

      // Should have 3 EnumConstantDecl (RED, GREEN, BLUE)
      assertEquals(enumConstants.length, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with function parameters",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int add(int a, int b, int c);`);

    try {
      // Find the function declaration
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Use helper to find function parameters
      const parmDecls = findFunctionParams(funcDecl);

      // Should have 3 ParmDecl
      assertEquals(parmDecls.length, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren Recurse descends into children",
  async fn() {
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      // Get the children buffers - visitChildren returns buffers
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Recurse,
      );

      // Find struct decl in children
      const structDecl = children.find((buffer) => {
        const kind = getCursorKind(
          buffer as unknown as Parameters<typeof getCursorKind>[0],
        );
        return kind === CXCursorKind.StructDecl;
      });
      assertExists(structDecl);

      // Visit the struct's children (the fields)
      const structChildren = visitChildren(
        structDecl as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );

      // Should have visited: TU -> StructDecl -> FieldDecl (x) -> FieldDecl (y)
      // With Recurse on TU, we should see StructDecl
      // Then visit StructDecl's children to find fields
      const fieldDecls = structChildren.filter((buffer) => {
        const kind = getCursorKind(
          buffer as unknown as Parameters<typeof getCursorKind>[0],
        );
        return kind === CXCursorKind.FieldDecl;
      });

      assertEquals(fieldDecls.length, 2); // x and y
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - buffer round-trip from visitChildren",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int my_global = 42;`);

    try {
      // Get buffers from visitChildren
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Continue,
      );

      // Verify each buffer can be used with getCursorKind
      for (const buffer of children) {
        const kind = getCursorKind(
          buffer as unknown as Parameters<typeof getCursorKind>[0],
        );
        assertExists(kind);
        assertEquals(kind > 0, true);

        // Verify spelling works on buffer
        const spelling = getCursorSpellingFromBuffer(
          buffer as unknown as Parameters<
            typeof getCursorSpellingFromBuffer
          >[0],
        );
        assertExists(spelling);

        // If it's a VarDecl, verify USR works
        if (kind === CXCursorKind.VarDecl) {
          const usr = getCursorUSR(
            buffer as unknown as Parameters<typeof getCursorUSR>[0],
          );
          assertExists(usr);
        }
      }
    } finally {
      await cleanup();
    }
  },
});
