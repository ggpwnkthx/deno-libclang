/**
 * Tests for helper functions
 */

import { assertEquals, assertExists } from "@std/assert";
import { CXCursorKind } from "../mod.ts";
import {
  getCursorExtent,
  getCursorLocation,
  getFile,
  getLocation,
} from "../mod.ts";
import {
  parseSourceLocation,
  parseSourceRange,
} from "../src/libclang/helpers.ts";
import type { CXSourceRange } from "../src/ffi/types.ts";
import { findCursorByKind, parseC } from "./test_utils.ts";

Deno.test({
  name: "helpers - parseSourceLocation via getCursorLocation",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int x = 5;`);

    try {
      // Find the VarDecl for 'x'
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      // getCursorLocation internally uses parseSourceLocation
      // This test verifies the full pipeline works correctly
      const location = getCursorLocation(
        varDecl as unknown as Parameters<typeof getCursorLocation>[0],
      );

      assertExists(location);
      assertExists(location.line);
      assertExists(location.column);
      assertEquals(typeof location.line, "number");
      assertEquals(typeof location.column, "number");

      // Line should be positive (1-based)
      assertEquals(location.line > 0, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceLocation with actual location data",
  async fn() {
    const { tu, file, cleanup } = await parseC(`int main() { return 0; }`);

    try {
      const cxFile = getFile(tu, file);
      assertExists(cxFile);

      // Get actual source location from libclang
      const location = getLocation(tu, cxFile, 1, 1);
      assertExists(location);
      assertExists(location.int_data);

      // Parse the location using helper
      const parsed = parseSourceLocation(location);

      // Verify parsed structure
      assertExists(parsed);
      assertExists(parsed.line);
      assertExists(parsed.column);
      assertEquals(typeof parsed.line, "number");
      assertEquals(typeof parsed.column, "number");

      // Line should be positive (1-based)
      assertEquals(parsed.line > 0, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceLocation at different positions",
  async fn() {
    // Multi-line code to test different line/column positions
    const { tu, file, cleanup } = await parseC(
      `int main() {\n  int x = 5;\n  return x;\n}`,
    );

    try {
      const cxFile = getFile(tu, file);
      assertExists(cxFile);

      // Test location at line 2, column 5 (where "int x" starts)
      const location2 = getLocation(tu, cxFile, 2, 5);
      const parsed2 = parseSourceLocation(location2);
      assertExists(parsed2);
      assertEquals(parsed2.line > 0, true);

      // Test location at line 3, column 10 (where "return" starts)
      const location3 = getLocation(tu, cxFile, 3, 10);
      const parsed3 = parseSourceLocation(location3);
      assertExists(parsed3);
      assertEquals(parsed3.line > 0, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceRange via getCursorExtent",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int main() { return 0; }`);

    try {
      // Find the FunctionDecl
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // getCursorExtent internally uses parseSourceRange
      // This test verifies the full pipeline works correctly
      const extent = getCursorExtent(
        funcDecl as unknown as Parameters<typeof getCursorExtent>[0],
      );

      // Verify extent has valid data
      assertExists(extent);
      assertExists(extent.start);
      assertExists(extent.end);
      assertExists(extent.start.line);
      assertExists(extent.end.line);

      // Line numbers should be positive
      assertEquals(extent.start.line > 0, true);
      assertEquals(extent.end.line > 0, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceRange with valid pointers",
  async fn() {
    const { tu, file, cleanup } = await parseC(`int main() { return 0; }`);

    try {
      const cxFile = getFile(tu, file);
      assertExists(cxFile);

      // Get two locations to create a range
      const startLoc = getLocation(tu, cxFile, 1, 1);
      const endLoc = getLocation(tu, cxFile, 1, 20);

      // Create a range with valid pointer data
      const range: CXSourceRange = {
        ptr_data: [
          startLoc as unknown as bigint,
          endLoc as unknown as bigint,
        ] as unknown as CXSourceRange["ptr_data"],
        int_data: [0, 0] as unknown as CXSourceRange["int_data"],
      };

      const parsed = parseSourceRange(range);

      // Verify parsed structure has start and end
      assertExists(parsed);
      assertExists(parsed.start);
      assertExists(parsed.end);
      assertExists(parsed.start.line);
      assertExists(parsed.end.line);
    } finally {
      await cleanup();
    }
  },
});
