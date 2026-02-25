/**
 * Tests for library location functions
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  findLocalLibclang,
  getLibclang,
  getPlatform,
} from "../src/libclang/locate.ts";

Deno.test({
  name: "locate - getPlatform",
  fn() {
    const platform = getPlatform();
    assertExists(platform);
    assertExists(platform.os);
    assertExists(platform.arch);
    assertExists(platform.ext);

    // Verify it's a valid OS
    const validOs = ["linux", "darwin", "windows"];
    assertEquals(validOs.includes(platform.os), true);
  },
});

Deno.test({
  name: "locate - findLocalLibclang",
  fn() {
    const libPath = findLocalLibclang();
    // findLocalLibclang may return null if libclang is not installed
    // but on the test system it should be installed
    if (libPath !== null) {
      assertEquals(typeof libPath, "string");
      assertEquals(libPath.length > 0, true);
    }
  },
});

Deno.test({
  name: "locate - getLibclang",
  fn() {
    // getLibclang should throw if libclang is not found
    // but should return a path if it is found
    try {
      const libPath = getLibclang();
      assertExists(libPath);
      assertEquals(typeof libPath, "string");
      assertEquals(libPath.length > 0, true);
    } catch (e) {
      // If libclang is not installed, this test may fail
      // but that's expected behavior
      const err = e as Error;
      assertStringIncludes(err.message, "libclang not found");
    }
  },
});
