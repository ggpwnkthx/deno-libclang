/**
 * Tests for NativeCXCursor class
 */

import { assertEquals, assertExists } from "@std/assert";
import { NativeCXCursor } from "../src/libclang/native_cursor.ts";

Deno.test({
  name: "nativeCursor - constructor and getBuffer",
  fn() {
    const cursor = new NativeCXCursor(1, 2, 3n, 4n, 5n);
    const buffer = cursor.getBuffer();

    assertExists(buffer);
    assertEquals(buffer.length, 40);
  },
});

Deno.test({
  name: "nativeCursor - getKind",
  fn() {
    const kind = 42;
    const cursor = new NativeCXCursor(kind, 0, 0n, 0n, 0n);

    assertEquals(cursor.getKind(), kind);
  },
});

Deno.test({
  name: "nativeCursor - getXdata",
  fn() {
    const xdata = 123;
    const cursor = new NativeCXCursor(0, xdata, 0n, 0n, 0n);

    assertEquals(cursor.getXdata(), xdata);
  },
});

Deno.test({
  name: "nativeCursor - getData",
  fn() {
    const data0 = 0x1111111111111111n;
    const data1 = 0x2222222222222222n;
    const data2 = 0x3333333333333333n;
    const cursor = new NativeCXCursor(0, 0, data0, data1, data2);

    assertEquals(cursor.getData(0), data0);
    assertEquals(cursor.getData(1), data1);
    assertEquals(cursor.getData(2), data2);
  },
});

Deno.test({
  name: "nativeCursor - toCXCursor",
  fn() {
    const kind = 5;
    const xdata = 10;
    const data0 = 0x100000000n;
    const data1 = 0x200000000n;
    const data2 = 0x300000000n;

    const cursor = new NativeCXCursor(kind, xdata, data0, data1, data2);
    const cxCursor = cursor.toCXCursor();

    assertExists(cxCursor);
    assertEquals(cxCursor.kind, kind);
    assertEquals(cxCursor.xdata, xdata);
  },
});
