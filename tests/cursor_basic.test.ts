/**
 * Tests for basic cursor operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
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
  getCursorUSR,
  load,
  unload,
} from "../mod.ts";
import {
  assertStringIncludes,
  findCursorByKind,
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
