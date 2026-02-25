/**
 * Tests for platform utility functions
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  dirExists,
  getCommonLibPaths,
  getPlatformLibName,
  pathExists,
} from "../src/utils/platform.ts";

Deno.test({
  name: "platform - getPlatformLibName",
  fn() {
    const libName = getPlatformLibName("testlib");
    const os = Deno.build.os;

    if (os === "windows") {
      assertEquals(libName, "testlib.dll");
    } else if (os === "darwin") {
      assertEquals(libName, "testlib.dylib");
    } else if (os === "linux") {
      assertEquals(libName, "testlib.so");
    }
  },
});

Deno.test({
  name: "platform - getCommonLibPaths",
  fn() {
    const paths = getCommonLibPaths();
    assertExists(paths);
    assertEquals(Array.isArray(paths), true);
    assertEquals(paths.length > 0, true);
  },
});

Deno.test({
  name: "platform - pathExists",
  fn() {
    // Test with existing file
    const exists = pathExists("tests/test_utils.ts");
    assertEquals(exists, true);

    // Test with non-existing file
    const notExists = pathExists("/nonexistent/file.txt");
    assertEquals(notExists, false);
  },
});

Deno.test({
  name: "platform - dirExists",
  fn() {
    // Test with existing directory
    const exists = dirExists("tests");
    assertEquals(exists, true);

    // Test with non-existing directory
    const notExists = dirExists("/nonexistent/dir");
    assertEquals(notExists, false);
  },
});
