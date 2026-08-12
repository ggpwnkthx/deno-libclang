/**
 * Tests for library location functions
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  clearLibclangCache,
  findLocalLibclang,
  findLocalResourceDir,
  findResourceDirCandidates,
  getLibclang,
  getLibclangCandidates,
  getPlatform,
  isValidResourceDir,
} from "../libclang/locate.ts";

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

// ============================================================================
// Resource directory tests
// ============================================================================

Deno.test({
  name: "locate - findResourceDirCandidates returns non-empty array",
  fn() {
    const candidates = findResourceDirCandidates();
    assertExists(candidates);
    assertEquals(Array.isArray(candidates), true);
    assertEquals(candidates.length > 0, true);
  },
});

Deno.test({
  name: "locate - LIBCLANG_RESOURCE_DIR wins when valid",
  fn() {
    // Build a fake resource dir with a recognized sentinel header.
    const dir = Deno.makeTempDirSync({ prefix: "fake-resource-dir-" });
    const includeDir = `${dir}/include`;
    Deno.mkdirSync(includeDir);
    Deno.writeTextFileSync(`${includeDir}/stddef.h`, "");

    Deno.env.delete("LIBCLANG_RESOURCE_DIR");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_RESOURCE_DIR", dir);
      clearLibclangCache();
      assertEquals(findLocalResourceDir(), dir);
    } finally {
      Deno.env.delete("LIBCLANG_RESOURCE_DIR");
      clearLibclangCache();
      Deno.removeSync(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "locate - LIBCLANG_RESOURCE_DIR without include/ falls through",
  fn() {
    // Directory exists but has no include/stddef.h — should not be returned.
    const dir = Deno.makeTempDirSync({ prefix: "fake-empty-resource-" });
    Deno.writeTextFileSync(`${dir}/unrelated.txt`, "");

    Deno.env.delete("LIBCLANG_RESOURCE_DIR");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_RESOURCE_DIR", dir);
      clearLibclangCache();
      const result = findLocalResourceDir();
      // Must not return the invalid directory.
      assertEquals(result === dir, false);
    } finally {
      Deno.env.delete("LIBCLANG_RESOURCE_DIR");
      clearLibclangCache();
      Deno.removeSync(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "locate - LIBCLANG_RESOURCE_DIR nonexistent dir falls through",
  fn() {
    Deno.env.delete("LIBCLANG_RESOURCE_DIR");
    clearLibclangCache();
    try {
      Deno.env.set(
        "LIBCLANG_RESOURCE_DIR",
        "/__definitely_nonexistent_resource_dir__",
      );
      clearLibclangCache();
      const result = findLocalResourceDir();
      if (result !== null) {
        assertEquals(
          result !== "/__definitely_nonexistent_resource_dir__",
          true,
        );
      }
    } finally {
      Deno.env.delete("LIBCLANG_RESOURCE_DIR");
      clearLibclangCache();
    }
  },
});

Deno.test({
  name: "locate - env override appears first in candidates list",
  fn() {
    Deno.env.set("LIBCLANG_RESOURCE_DIR", "/custom/resource-dir");
    clearLibclangCache();
    try {
      const candidates = findResourceDirCandidates();
      assertEquals(candidates[0], "/custom/resource-dir");
    } finally {
      Deno.env.delete("LIBCLANG_RESOURCE_DIR");
      clearLibclangCache();
    }
  },
});

Deno.test({
  name: "locate - isValidResourceDir accepts real layout",
  fn() {
    const dir = Deno.makeTempDirSync({ prefix: "valid-rd-" });
    const includeDir = `${dir}/include`;
    Deno.mkdirSync(includeDir);
    Deno.writeTextFileSync(`${includeDir}/stdarg.h`, "");
    try {
      assertEquals(isValidResourceDir(dir), true);
    } finally {
      Deno.removeSync(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "locate - isValidResourceDir rejects bare directories",
  fn() {
    const dir = Deno.makeTempDirSync({ prefix: "invalid-rd-" });
    try {
      assertEquals(isValidResourceDir(dir), false);
    } finally {
      Deno.removeSync(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "locate - findResourceDirCandidates includes per-OS well-known paths",
  fn() {
    const platform = getPlatform();
    const candidates = findResourceDirCandidates();
    assertEquals(candidates.length > 0, true);
    if (platform.os === "linux") {
      // Spot-check a few Linux paths.
      const joined = candidates.join("\n");
      assertEquals(joined.includes("/usr/lib/llvm-"), true);
    } else if (platform.os === "darwin") {
      const joined = candidates.join("\n");
      // Homebrew opt glob strategy should emit at least one candidate.
      assertEquals(joined.includes("/opt/homebrew/opt/"), true);
    }
  },
});

// ============================================================================
// Linuxbrew tests (filesystem-only; no `--allow-run` needed)
// ============================================================================

Deno.test({
  name: "locate - getLibclangCandidates includes Linuxbrew per-user paths",
  fn() {
    if (Deno.build.os !== "linux") return;

    const candidates = getLibclangCandidates();
    const joined = candidates.join("\n");

    // Per-user static path under $HOME (emitted by linuxCandidates).
    const home = Deno.env.get("HOME");
    if (home) {
      assertEquals(
        joined.includes(`${home}/.linuxbrew/lib/libclang.so`),
        true,
      );
      assertEquals(
        joined.includes(`${home}/.linuxbrew/lib/libclang.so.1`),
        true,
      );
    }

    // Multi-user static path is always present on linux.
    assertEquals(
      joined.includes("/home/linuxbrew/.linuxbrew/lib/libclang.so"),
      true,
    );
    assertEquals(
      joined.includes("/home/linuxbrew/.linuxbrew/lib/libclang.so.1"),
      true,
    );
  },
});

Deno.test({
  name:
    "locate - getLibclangCandidates includes Linuxbrew HOMEBREW_PREFIX paths",
  fn() {
    if (Deno.build.os !== "linux") return;

    const fakePrefix = Deno.makeTempDirSync({
      prefix: "fake-linuxbrew-prefix-",
    });

    const savedPrefix = Deno.env.get("HOMEBREW_PREFIX");
    Deno.env.set("HOMEBREW_PREFIX", fakePrefix);
    clearLibclangCache();
    try {
      const candidates = getLibclangCandidates();
      const joined = candidates.join("\n");
      assertEquals(joined.includes(`${fakePrefix}/lib/libclang.so`), true);
      assertEquals(joined.includes(`${fakePrefix}/lib/libclang.so.1`), true);
    } finally {
      if (savedPrefix !== undefined) {
        Deno.env.set("HOMEBREW_PREFIX", savedPrefix);
      } else {
        Deno.env.delete("HOMEBREW_PREFIX");
      }
      clearLibclangCache();
      Deno.removeSync(fakePrefix, { recursive: true });
    }
  },
});

Deno.test({
  name: "locate - findResourceDirCandidates includes Linuxbrew bases on linux",
  fn() {
    if (Deno.build.os !== "linux") return;

    const fakeHome = Deno.makeTempDirSync({ prefix: "fake-linuxbrew-rd-" });
    const savedHome = Deno.env.get("HOME");
    Deno.env.set("HOME", fakeHome);
    clearLibclangCache();
    try {
      const candidates = findResourceDirCandidates();
      const joined = candidates.join("\n");
      // Static Linuxbrew per-user base (linuxResourceDirCandidates fallback).
      assertEquals(
        joined.includes(`${fakeHome}/.linuxbrew/lib/clang/`),
        true,
      );
      // Static Linuxbrew multi-user base is always present on linux.
      assertEquals(
        joined.includes(`/home/linuxbrew/.linuxbrew/lib/clang/`),
        true,
      );
    } finally {
      if (savedHome !== undefined) {
        Deno.env.set("HOME", savedHome);
      } else {
        Deno.env.delete("HOME");
      }
      clearLibclangCache();
      Deno.removeSync(fakeHome, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "locate - homebrewOptGlobStrategy finds llvm dir under per-user Linuxbrew opt",
  fn() {
    if (Deno.build.os !== "linux") return;

    // Create a $HOME/.linuxbrew/opt/llvm dir so homebrewOptGlobStrategy's
    // dirExists + readDirNames pass picks it up.
    const fakeHome = Deno.makeTempDirSync({ prefix: "fake-linuxbrew-glob-" });
    const optDir = `${fakeHome}/.linuxbrew/opt`;
    const formulaDir = `${optDir}/llvm`;
    Deno.mkdirSync(`${formulaDir}/lib`, { recursive: true });

    const savedHome = Deno.env.get("HOME");
    Deno.env.set("HOME", fakeHome);
    clearLibclangCache();
    try {
      const candidates = findResourceDirCandidates();
      const joined = candidates.join("\n");
      // Per-formula dynamic glob candidates.
      assertEquals(
        joined.includes(`${optDir}/llvm/lib/clang/`),
        true,
      );
    } finally {
      if (savedHome !== undefined) {
        Deno.env.set("HOME", savedHome);
      } else {
        Deno.env.delete("HOME");
      }
      clearLibclangCache();
      Deno.removeSync(fakeHome, { recursive: true });
    }
  },
});
