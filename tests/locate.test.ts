/**
 * Tests for library location functions
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  clearLibclangCache,
  findLocalLibclang,
  getLibclang,
  getLibclangCandidates,
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

Deno.test({
  name: "locate - getLibclangCandidates returns non-empty array",
  fn() {
    const candidates = getLibclangCandidates();
    assertExists(candidates);
    assertEquals(Array.isArray(candidates), true);
    assertEquals(candidates.length > 0, true);
  },
});

Deno.test({
  name: "locate - LIBCLANG_LIBRARY_PATH wins when file exists",
  fn() {
    const tmp = Deno.makeTempFileSync({ prefix: "fake-libclang-" });
    Deno.env.delete("LIBCLANG_LIBRARY_PATH");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_LIBRARY_PATH", tmp);
      clearLibclangCache();
      assertEquals(findLocalLibclang(), tmp);
    } finally {
      Deno.env.delete("LIBCLANG_LIBRARY_PATH");
      clearLibclangCache();
      Deno.removeSync(tmp);
    }
  },
});

Deno.test({
  name: "locate - LIBCLANG_LIBRARY_PATH to nonexistent file falls through",
  fn() {
    const original = Deno.env.get("LIBCLANG_LIBRARY_PATH");
    Deno.env.set(
      "LIBCLANG_LIBRARY_PATH",
      "/__definitely_nonexistent_libclang__.so",
    );
    clearLibclangCache();
    try {
      const result = findLocalLibclang();
      // Must not return the nonexistent path; either null or a real system path.
      if (result !== null) {
        assertEquals(
          result !== "/__definitely_nonexistent_libclang__.so",
          true,
        );
      }
    } finally {
      if (original !== undefined) {
        Deno.env.set("LIBCLANG_LIBRARY_PATH", original);
      } else {
        Deno.env.delete("LIBCLANG_LIBRARY_PATH");
      }
      clearLibclangCache();
    }
  },
});

Deno.test({
  name: "locate - LLVM_HOME appends /lib/<libname>",
  fn() {
    const dir = Deno.makeTempDirSync({ prefix: "fake-llvm-home-" });
    const libDir = `${dir}/lib`;
    Deno.mkdirSync(libDir);
    const libPath = `${libDir}/libclang.so`;
    Deno.writeTextFileSync(libPath, "");
    Deno.env.delete("LLVM_HOME");
    clearLibclangCache();
    try {
      Deno.env.set("LLVM_HOME", dir);
      clearLibclangCache();
      assertEquals(findLocalLibclang(), libPath);
    } finally {
      Deno.env.delete("LLVM_HOME");
      clearLibclangCache();
      Deno.removeSync(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "locate - LIBCLANG_PATH fallback is honored",
  fn() {
    const tmp = Deno.makeTempFileSync({ prefix: "fake-libclang-path-" });
    Deno.env.delete("LIBCLANG_PATH");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_PATH", tmp);
      clearLibclangCache();
      assertEquals(findLocalLibclang(), tmp);
    } finally {
      Deno.env.delete("LIBCLANG_PATH");
      clearLibclangCache();
      Deno.removeSync(tmp);
    }
  },
});

Deno.test({
  name: "locate - env override appears first in candidates list",
  fn() {
    Deno.env.set("LIBCLANG_LIBRARY_PATH", "/custom/libclang.so");
    clearLibclangCache();
    try {
      const candidates = getLibclangCandidates();
      assertEquals(candidates[0], "/custom/libclang.so");
    } finally {
      Deno.env.delete("LIBCLANG_LIBRARY_PATH");
      clearLibclangCache();
    }
  },
});

Deno.test({
  name: "locate - resolved result is cached and cleared",
  fn() {
    const tmpA = Deno.makeTempFileSync({ prefix: "libclang-cache-a-" });
    const tmpB = Deno.makeTempFileSync({ prefix: "libclang-cache-b-" });
    Deno.env.delete("LIBCLANG_LIBRARY_PATH");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_LIBRARY_PATH", tmpA);
      clearLibclangCache();
      assertEquals(findLocalLibclang(), tmpA);

      // Switch env var without clearing cache: still returns tmpA.
      Deno.env.set("LIBCLANG_LIBRARY_PATH", tmpB);
      assertEquals(findLocalLibclang(), tmpA);

      // After clearLibclangCache, lookup re-evaluates and returns tmpB.
      clearLibclangCache();
      assertEquals(findLocalLibclang(), tmpB);
    } finally {
      Deno.env.delete("LIBCLANG_LIBRARY_PATH");
      clearLibclangCache();
      Deno.removeSync(tmpA);
      Deno.removeSync(tmpB);
    }
  },
});

Deno.test({
  name: "locate - clearLibclangCache makes next lookup re-evaluate",
  fn() {
    const tmp = Deno.makeTempFileSync({ prefix: "libclang-clear-" });
    Deno.env.delete("LIBCLANG_LIBRARY_PATH");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_LIBRARY_PATH", tmp);
      clearLibclangCache();
      const first = findLocalLibclang();
      assertEquals(first, tmp);

      // Removing env var and clearing should not return the unset tmp.
      Deno.env.delete("LIBCLANG_LIBRARY_PATH");
      clearLibclangCache();
      const second = findLocalLibclang();
      assertEquals(second === tmp, false);
    } finally {
      Deno.env.delete("LIBCLANG_LIBRARY_PATH");
      clearLibclangCache();
      Deno.removeSync(tmp);
    }
  },
});
