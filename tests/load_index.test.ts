/**
 * Tests for library loading and CXIndex creation
 */

import { assertExists } from "@std/assert";
import { createIndex, disposeIndex, load, unload } from "../mod.ts";

Deno.test({
  name: "load - throws error when loading non-existent library",
  fn() {
    // Unload first to ensure we try to load a fresh library
    unload();
    try {
      load("/nonexistent/path/libclang.so");
      throw new Error("Expected load to throw");
    } catch (e) {
      const err = e as Error;
      if (!err.message.includes("Failed to load libclang")) {
        throw e;
      }
    }
    unload();
  },
});

Deno.test({
  name: "index - create and dispose index",
  fn() {
    load();

    const index = createIndex();
    assertExists(index);

    disposeIndex(index);
    unload();
  },
});

Deno.test({
  name: "index - create index with options",
  fn() {
    load();

    const index1 = createIndex(true, false);
    assertExists(index1);
    disposeIndex(index1);

    const index2 = createIndex(false, true);
    assertExists(index2);
    disposeIndex(index2);

    const index3 = createIndex(true, true);
    assertExists(index3);
    disposeIndex(index3);
    unload();
  },
});
