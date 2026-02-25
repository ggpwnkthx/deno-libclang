/**
 * Tests for file and location operations
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  createIndex,
  disposeIndex,
  disposeTranslationUnit,
  fileIsNull,
  getFile,
  getFileName,
  getLocation,
  load,
  parseTranslationUnit,
  unload,
} from "../mod.ts";
import type { CXFile } from "../src/ffi/types.ts";

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
      // Request location at line 1, column 1
      const location = getLocation(result.translationUnit, cxFile, 1, 1);

      assertExists(location);
      assertExists(location.int_data);
      // The int_data encodes line and column information
      // Lower 32 bits should contain the line number - verify it's a valid positive number
      const line = location.int_data & 0xFFFFFFFF;
      assertEquals(line > 0, true);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "file - fileIsNull",
  async fn() {
    load();

    const index = createIndex();
    const code = `int x = 5;`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Get a valid file
      const cxFile = getFile(result.translationUnit, file);
      assertExists(cxFile);

      // Test fileIsNull with valid file - should be false
      const isNull = fileIsNull(cxFile);
      assertEquals(isNull, false);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "file - fileIsNull with null file",
  fn() {
    load();

    // Test fileIsNull with null file - should return true
    const nullFile: CXFile = null as unknown as CXFile;
    const isNullNull = fileIsNull(nullFile);
    assertEquals(isNullNull, true);

    // Test fileIsNull with undefined - should return true
    const undefinedFile: CXFile = undefined as unknown as CXFile;
    const isNullUndefined = fileIsNull(undefinedFile);
    assertEquals(isNullUndefined, true);

    unload();
  },
});
