/**
 * Tests for cursor enum constant operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXChildVisitResult,
  CXCursorKind,
  getCursorKind,
  getCursorSpellingFromBuffer,
  getCursorUSR,
  getEnumConstantDeclUnsignedValue,
  getEnumConstantDeclValue,
  visitChildren,
} from "../mod.ts";
import {
  findChildByKind,
  findCursorByKind,
  findEnumConstants,
  parseC,
} from "./test_utils.ts";

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
