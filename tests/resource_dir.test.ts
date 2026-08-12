/**
 * Tests for resource directory handling at the library/TU boundary:
 * - getLibraryResourceDir() resolves lazily on first call (not at load()).
 * - parseTranslationUnit auto-injects `-resource-dir` when not provided.
 * - getResourceDir(tu) returns what libclang itself reports.
 * - disableImplicitResourceDir opt-out works.
 * - LIBCLANG_RESOURCE_DIR override flows through to parsing.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createIndex,
  disposeIndex,
  disposeTranslationUnit,
  findLocalResourceDir,
  getLibraryResourceDir,
  getResourceDir,
  getTranslationUnitCursor,
  load,
  parseTranslationUnit,
  unload,
} from "../mod.ts";
import { clearLibclangCache } from "../libclang/locate.ts";

function makeCFileSync(content: string): string {
  const f = Deno.makeTempFileSync({ suffix: ".c" });
  Deno.writeTextFileSync(f, content);
  return f;
}

Deno.test({
  name: "resource - load() exposes resource dir via lazy resolution",
  fn() {
    // Build a recognizable fake resource dir for a clean test signal.
    const dir = Deno.makeTempDirSync({ prefix: "rd-eager-" });
    const includeDir = `${dir}/include`;
    Deno.mkdirSync(includeDir);
    Deno.writeTextFileSync(`${includeDir}/stddef.h`, "");

    Deno.env.delete("LIBCLANG_RESOURCE_DIR");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_RESOURCE_DIR", dir);
      clearLibclangCache();

      load();

      const rd = getLibraryResourceDir();
      // On a host with libclang installed, the auto-detected resource dir
      // may match ours. When LIBCLANG_RESOURCE_DIR is honored, it must win.
      assertEquals(rd, dir);

      unload();
    } finally {
      Deno.env.delete("LIBCLANG_RESOURCE_DIR");
      clearLibclangCache();
      Deno.removeSync(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "resource - parseTranslationUnit auto-injects -resource-dir",
  fn() {
    load();

    const index = createIndex();
    const file = makeCFileSync(`int x = 5;`);
    try {
      // No `-resource-dir` in args; library should inject it.
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      // Confirm via libclang's own report (when the symbol is available):
      // getResourceDir(tu) must return a non-empty path matching what
      // we resolved. Some libclang 21+ builds removed this symbol; the
      // function then returns the empty string.
      const reported = getResourceDir(result.translationUnit);
      assertEquals(typeof reported, "string");

      // If the library resolved one AND the symbol is exported, what
      // libclang reports should match.
      const libRd = getLibraryResourceDir();
      if (libRd && reported.length > 0) {
        assertEquals(reported, libRd);
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      Deno.removeSync(file);
      unload();
    }
  },
});

Deno.test({
  name: "resource - user-supplied -resource-dir wins over auto-injection",
  fn() {
    const customDir = Deno.makeTempDirSync({ prefix: "rd-custom-" });
    const customInclude = `${customDir}/include`;
    Deno.mkdirSync(customInclude);
    Deno.writeTextFileSync(`${customInclude}/stddef.h`, "");

    load();
    const index = createIndex();
    const file = makeCFileSync(`int x = 5;`);
    try {
      const result = parseTranslationUnit(
        index,
        file,
        ["-resource-dir", customDir],
      );
      assertExists(result.translationUnit);

      const reported = getResourceDir(result.translationUnit);
      // Only assert equality when the libclang symbol is exported; older
      // and some newer libclang builds omit it.
      if (reported.length > 0) {
        assertEquals(reported, customDir);
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      Deno.removeSync(file);
      Deno.removeSync(customDir, { recursive: true });
      unload();
    }
  },
});

Deno.test({
  name: "resource - user-supplied -resource-dir= form is also honored",
  fn() {
    const customDir = Deno.makeTempDirSync({ prefix: "rd-custom-eq-" });
    const customInclude = `${customDir}/include`;
    Deno.mkdirSync(customInclude);
    Deno.writeTextFileSync(`${customInclude}/stddef.h`, "");

    load();
    const index = createIndex();
    const file = makeCFileSync(`int x = 5;`);
    try {
      const result = parseTranslationUnit(
        index,
        file,
        [`-resource-dir=${customDir}`],
      );
      assertExists(result.translationUnit);

      const reported = getResourceDir(result.translationUnit);
      if (reported.length > 0) {
        assertEquals(reported, customDir);
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      Deno.removeSync(file);
      Deno.removeSync(customDir, { recursive: true });
      unload();
    }
  },
});

Deno.test({
  name: "resource - disableImplicitResourceDir skips injection",
  fn() {
    load();

    const index = createIndex();
    const file = makeCFileSync(`int x = 5;`);
    try {
      // Disable injection. We still expect parsing to succeed when
      // libclang itself was built with a bundled resource dir (the
      // common case for system LLVM installs). We only verify the
      // injection was skipped.
      const result = parseTranslationUnit(
        index,
        file,
        [],
        [],
        { disableImplicitResourceDir: true },
      );
      assertExists(result.translationUnit);

      // The TU-level getResourceDir must NOT equal our auto-resolved dir,
      // because we asked the library not to inject it.
      const reported = getResourceDir(result.translationUnit);
      const libRd = getLibraryResourceDir();
      if (libRd && reported.length > 0) {
        assertEquals(reported !== libRd, true);
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      Deno.removeSync(file);
      unload();
    }
  },
});

Deno.test({
  name: "resource - getResourceDir(tu) returns a string",
  fn() {
    load();
    const index = createIndex();
    const file = makeCFileSync(`int x = 5;`);
    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);
      // Returns empty string when the loaded libclang does not export
      // clang_getResourceDirName; otherwise the actual resource dir path.
      const rd = getResourceDir(result.translationUnit);
      assertEquals(typeof rd, "string");
      // Just ensure the cursor API is also reachable on the same TU.
      const tuCursor = getTranslationUnitCursor(result.translationUnit);
      assertExists(tuCursor);
      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      Deno.removeSync(file);
      unload();
    }
  },
});

Deno.test({
  name: "resource - findLocalResourceDir cached",
  fn() {
    // Build a fake valid resource dir.
    const dir = Deno.makeTempDirSync({ prefix: "rd-cached-" });
    const includeDir = `${dir}/include`;
    Deno.mkdirSync(includeDir);
    Deno.writeTextFileSync(`${includeDir}/stddef.h`, "");

    Deno.env.delete("LIBCLANG_RESOURCE_DIR");
    clearLibclangCache();
    try {
      Deno.env.set("LIBCLANG_RESOURCE_DIR", dir);
      clearLibclangCache();
      assertEquals(findLocalResourceDir(), dir);

      // Switch the env to a different valid dir. Without clearLibclangCache,
      // the cache must still return the first one.
      const dir2 = Deno.makeTempDirSync({ prefix: "rd-cached-2-" });
      const include2 = `${dir2}/include`;
      Deno.mkdirSync(include2);
      Deno.writeTextFileSync(`${include2}/stddef.h`, "");
      try {
        Deno.env.set("LIBCLANG_RESOURCE_DIR", dir2);
        assertEquals(findLocalResourceDir(), dir);

        // After clearLibclangCache, the lookup re-evaluates.
        clearLibclangCache();
        assertEquals(findLocalResourceDir(), dir2);
      } finally {
        Deno.removeSync(dir2, { recursive: true });
      }
    } finally {
      Deno.env.delete("LIBCLANG_RESOURCE_DIR");
      clearLibclangCache();
      Deno.removeSync(dir, { recursive: true });
    }
  },
});
