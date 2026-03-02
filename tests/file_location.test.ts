/**
 * Tests for file and location operations
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  CXChildVisitResult,
  CXCursorKind,
  fileIsNull,
  getCursorKind,
  getCursorLocation,
  getCursorSpelling,
  getFile,
  getFileName,
  getLocation,
  visitChildren,
} from "../mod.ts";
import type { CXFile } from "../src/ffi/types.ts";
import { findCursorByKind, parseC } from "./test_utils.ts";
import { CX_CURSOR_SIZE } from "../src/utils/ffi.ts";

Deno.test({
  name: "file - get file from translation unit",
  async fn() {
    const { tu, file, cleanup } = await parseC(`int x = 5;`);
    try {
      const cxFile = getFile(tu, file);
      assertExists(cxFile);

      const fileName = getFileName(cxFile);
      assertStringIncludes(fileName, ".c");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "location - get source location",
  async fn() {
    const { tu, file, cleanup } = await parseC(`int main() { return 0; }`);
    try {
      const cxFile = getFile(tu, file);
      // Request location at line 1, column 1
      const location = getLocation(tu, cxFile, 1, 1);

      assertExists(location);
      assertExists(location.int_data);
      // The int_data encodes line and column information
      // Lower 32 bits should contain the line number - verify it's a valid positive number
      const line = location.int_data & 0xFFFFFFFF;
      assertEquals(line > 0, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "file - fileIsNull",
  async fn() {
    const { tu, file, cleanup } = await parseC(`int x = 5;`);
    try {
      // Get a valid file
      const cxFile = getFile(tu, file);
      assertExists(cxFile);

      // Test fileIsNull with valid file - should be false
      const isNull = fileIsNull(cxFile);
      assertEquals(isNull, false);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "file - fileIsNull with null file",
  fn() {
    // Test fileIsNull with null file - should return true
    const nullFile: CXFile = null as unknown as CXFile;
    const isNullNull = fileIsNull(nullFile);
    assertEquals(isNullNull, true);

    // Test fileIsNull with undefined - should return true
    const undefinedFile: CXFile = undefined as unknown as CXFile;
    const isNullUndefined = fileIsNull(undefinedFile);
    assertEquals(isNullUndefined, true);
  },
});

Deno.test({
  name: "location - parseSourceLocation ordering on known source",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `int first = 1;\nint second = 2;\nint third = 3;`,
    );
    try {
      // Get children as buffers first
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Visit each variable and check location ordering
      const locations: {
        name: string;
        line: number;
        column: number;
        offset: number;
      }[] = [];

      for (const buffer of children) {
        const view = new DataView(
          buffer.buffer,
          buffer.byteOffset,
          CX_CURSOR_SIZE,
        );
        const kind = view.getUint32(0, true);
        if (kind === CXCursorKind.VarDecl) {
          const spelling = getCursorSpelling(
            buffer as unknown as Parameters<typeof getCursorSpelling>[0],
          );
          const location = getCursorLocation(
            buffer as unknown as Parameters<typeof getCursorLocation>[0],
          );
          locations.push({ name: spelling, ...location });
        }
      }

      // Verify ordering: first, second, third
      assertEquals(locations.length, 3);
      assertEquals(locations[0].name, "first");
      assertEquals(locations[0].line, 1);
      assertEquals(locations[1].name, "second");
      assertEquals(locations[1].line, 2);
      assertEquals(locations[2].name, "third");
      assertEquals(locations[2].line, 3);

      // Verify offsets increase monotonically
      assertEquals(locations[0].offset < locations[1].offset, true);
      assertEquals(locations[1].offset < locations[2].offset, true);
    } finally {
      await cleanup();
    }
  },
});
