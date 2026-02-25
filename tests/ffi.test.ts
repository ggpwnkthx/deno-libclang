/**
 * Tests for FFI utility functions
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createPointerBuffer,
  cstringToPtr,
  getPointer,
  ptrToCString,
  setPointer,
} from "../src/utils/ffi.ts";

Deno.test({
  name: "ffi - createPointerBuffer",
  fn() {
    const buffer = createPointerBuffer();
    assertExists(buffer);
    assertEquals(buffer.length, 8);
    assertEquals(buffer instanceof Uint8Array, true);
  },
});

Deno.test({
  name: "ffi - setPointer and getPointer",
  fn() {
    const buffer = createPointerBuffer();
    const testPtr = 0x1234567890abcdefn;

    setPointer(buffer, testPtr);
    const retrieved = getPointer(buffer);

    assertEquals(retrieved, testPtr);
  },
});

Deno.test({
  name: "ffi - cstringToPtr and ptrToCString",
  fn() {
    const testStr = "Hello, World!";
    const ptr = cstringToPtr(testStr);
    assertExists(ptr);

    const result = ptrToCString(ptr);
    assertEquals(result, testStr);
  },
});

Deno.test({
  name: "ffi - ptrToCString with null pointer",
  fn() {
    const result = ptrToCString(null);
    assertEquals(result, "");
  },
});
