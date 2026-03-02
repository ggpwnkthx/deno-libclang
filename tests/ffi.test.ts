/**
 * Tests for FFI utility functions
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createPointerBuffer,
  cstringToPtr,
  getPointer,
  POINTER_SIZE,
  ptrToCString,
  setPointer,
} from "../src/utils/ffi.ts";

Deno.test({
  name: "ffi - createPointerBuffer",
  fn() {
    const buffer = createPointerBuffer();
    assertExists(buffer);
    assertEquals(buffer.length, POINTER_SIZE);
    assertEquals(buffer instanceof Uint8Array, true);
  },
});

Deno.test({
  name: "ffi - setPointer and getPointer",
  fn() {
    const buffer = createPointerBuffer();
    // Use a pointer value that fits in the pointer width
    const maxPtr = POINTER_SIZE === 8 ? 0xffffffffffffffffn : 0xffffffffn;
    const testPtr = 0x12345678n & maxPtr;

    setPointer(buffer, testPtr);
    const retrieved = getPointer(buffer);

    assertEquals(retrieved, testPtr);
  },
});

Deno.test({
  name: "ffi - cstringToPtr and ptrToCString",
  fn() {
    const testStr = "Hello, World!";
    const { ptr, keepAlive } = cstringToPtr(testStr);
    assertExists(ptr);

    const result = ptrToCString(ptr);
    assertEquals(result, testStr);

    // Keep the buffer alive during the test
    assertExists(keepAlive);
  },
});

Deno.test({
  name: "ffi - ptrToCString with null pointer",
  fn() {
    const result = ptrToCString(null);
    assertEquals(result, "");
  },
});
