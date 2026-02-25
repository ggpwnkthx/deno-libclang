/**
 * Tests for helper functions
 */

import { assertEquals, assertExists } from "@std/assert";
import { load, unload } from "../mod.ts";
import {
  createIndex,
  disposeIndex,
  disposeTranslationUnit,
  getFile,
  getLocation,
  parseTranslationUnit,
} from "../mod.ts";
import {
  parseSourceLocation,
  parseSourceRange,
} from "../src/libclang/helpers.ts";
import type { CXSourceLocation, CXSourceRange } from "../src/ffi/types.ts";

Deno.test({
  name: "helpers - parseSourceLocation",
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
      // Get location at line 1, column 1
      const location = {
        ptr_data: [
          cxFile as unknown as bigint,
          0n,
        ] as unknown as CXSourceLocation["ptr_data"],
        int_data: 1,
      };

      const parsed = parseSourceLocation(location as CXSourceLocation);

      assertExists(parsed);
      assertExists(parsed.line);
      assertExists(parsed.column);
      assertEquals(typeof parsed.line, "number");
      assertEquals(typeof parsed.column, "number");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceLocation with actual location data",
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
      assertExists(cxFile);

      // Get actual source location from libclang
      const location = getLocation(result.translationUnit, cxFile, 1, 1);
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

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceLocation at different positions",
  async fn() {
    load();

    const index = createIndex();
    // Multi-line code to test different line/column positions
    const code = `int main() {\n  int x = 5;\n  return x;\n}`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const cxFile = getFile(result.translationUnit, file);
      assertExists(cxFile);

      // Test location at line 2, column 5 (where "int x" starts)
      const location2 = getLocation(result.translationUnit, cxFile, 2, 5);
      const parsed2 = parseSourceLocation(location2);
      assertExists(parsed2);
      assertEquals(parsed2.line > 0, true);

      // Test location at line 3, column 10 (where "return" starts)
      const location3 = getLocation(result.translationUnit, cxFile, 3, 10);
      const parsed3 = parseSourceLocation(location3);
      assertExists(parsed3);
      assertEquals(parsed3.line > 0, true);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceRange with cursor extent",
  async fn() {
    load();

    const index = createIndex();
    const code = `int main() { return 0; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Get the file and try to get a range from it
      const cxFile = getFile(result.translationUnit, file);
      assertExists(cxFile);

      // Create a mock CXSourceRange - in real use this would come from cursor extent
      const range = {
        ptr_data: [0n, 0n] as unknown as CXSourceRange["ptr_data"],
        int_data: [0, 0] as unknown as CXSourceRange["int_data"],
      };

      const parsed = parseSourceRange(range as CXSourceRange);

      // When ptr_data has null values, it should return default values
      assertExists(parsed);
      assertExists(parsed.start);
      assertExists(parsed.end);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "helpers - parseSourceRange with valid pointers",
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
      assertExists(cxFile);

      // Get two locations to create a range
      const startLoc = getLocation(result.translationUnit, cxFile, 1, 1);
      const endLoc = getLocation(result.translationUnit, cxFile, 1, 20);

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

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});
