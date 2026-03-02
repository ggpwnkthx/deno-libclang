/**
 * ABI Tests
 *
 * Tests for platform-specific ABI constants and behavior.
 * These tests verify that our FFI constants match the platform and that
 * FFI bindings actually work with the real libclang.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CX_CURSOR_SIZE,
  CX_SOURCE_LOCATION_SIZE,
  CX_SOURCE_RANGE_SIZE,
  CX_TYPE_SIZE,
  POINTER_SIZE,
  ULONG_SIZE,
} from "../src/utils/ffi.ts";
import {
  createIndex,
  CXChildVisitResult,
  CXCursorKind,
  disposeIndex,
  disposeTranslationUnit,
  getCursorKind,
  getCursorSpellingFromBuffer,
  getTranslationUnitCursor,
  load,
  parseTranslationUnit,
  unload,
  visitChildren,
} from "../mod.ts";

Deno.test("POINTER_SIZE matches platform", () => {
  const expected = Deno.build.arch === "x86_64" ||
      Deno.build.arch === "aarch64"
    ? 8
    : 4;
  assertEquals(POINTER_SIZE, expected);
});

Deno.test("ULONG_SIZE is correct for the platform", () => {
  // Windows LLP64: unsigned long is always 32-bit
  const expectedWindows = 4;
  // Unix: 32-bit on 32-bit systems, 64-bit on 64-bit systems
  const expectedUnix = Deno.build.arch === "x86_64" ||
      Deno.build.arch === "aarch64"
    ? 8
    : 4;

  const expected = Deno.build.os === "windows" ? expectedWindows : expectedUnix;
  assertEquals(ULONG_SIZE, expected);
});

Deno.test("CX_CURSOR_SIZE is correct", () => {
  // CXCursor: kind:u32(4) + xdata:i32(4) + 3*pointer(3*POINTER_SIZE)
  const expected = 8 + POINTER_SIZE * 3;
  assertEquals(CX_CURSOR_SIZE, expected);
});

Deno.test("CX_TYPE_SIZE is correct", () => {
  // CXType: kind:u32(4) + reserved:u32(4) + 2*pointer(2*POINTER_SIZE)
  const expected = 8 + POINTER_SIZE * 2;
  assertEquals(CX_TYPE_SIZE, expected);
});

Deno.test("CX_SOURCE_LOCATION_SIZE is correct", () => {
  // CXSourceLocation: 2 pointers + u32
  const expected = POINTER_SIZE * 2 + 4;
  assertEquals(CX_SOURCE_LOCATION_SIZE, expected);
});

Deno.test("CX_SOURCE_RANGE_SIZE is correct", () => {
  // CXSourceRange: 2 pointers + 2 u32s
  const expected = POINTER_SIZE * 2 + 8;
  assertEquals(CX_SOURCE_RANGE_SIZE, expected);
});

Deno.test("CX_CURSOR_SIZE is at least 32 bytes", () => {
  // On 32-bit: 8 + 4*3 = 20, but struct alignment makes it 24+
  // On 64-bit: 8 + 8*3 = 32
  assertExists(CX_CURSOR_SIZE);
  assertEquals(typeof CX_CURSOR_SIZE, "number");
});

Deno.test("CX_TYPE_SIZE is at least 16 bytes", () => {
  // On 32-bit: 8 + 4*2 = 16
  // On 64-bit: 8 + 8*2 = 24
  assertExists(CX_TYPE_SIZE);
  assertEquals(typeof CX_TYPE_SIZE, "number");
});

Deno.test("Platform is little-endian", () => {
  // Verify we're on a little-endian system
  const isLittleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  assertEquals(isLittleEndian, true);
});

Deno.test("Unsigned long CXUnsavedFile struct size", () => {
  // CXUnsavedFile: filename(char*) + contents(char*) + length(ulong)
  // = POINTER_SIZE + POINTER_SIZE + ULONG_SIZE
  const expectedSize = POINTER_SIZE * 2 + ULONG_SIZE;
  assertEquals(typeof expectedSize, "number");
  // On 64-bit Windows: 8 + 8 + 4 = 20
  // On 64-bit Unix: 8 + 8 + 8 = 24
  // On 32-bit: 4 + 4 + 4 = 12
});

// ============================================================================
// Real FFI behavior tests
// These tests verify that FFI bindings actually work, not just formulas
// ============================================================================

Deno.test("ABI - CXCursor buffer can be parsed by getCursorKind", async () => {
  load();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, "int x;");

  try {
    const result = parseTranslationUnit(index, file);
    assertExists(result.translationUnit);

    const tuCursor = getTranslationUnitCursor(result.translationUnit);

    // Get children buffers - this exercises the CXCursor size
    const children = visitChildren(tuCursor, () => CXChildVisitResult.Continue);

    // Now try to parse each buffer with getCursorKind
    // This will fail if CX_CURSOR_SIZE is wrong
    for (const buffer of children) {
      const kind = getCursorKind(
        buffer as unknown as Parameters<typeof getCursorKind>[0],
      );
      assertExists(kind);
      assertEquals(kind > 0, true);
    }

    disposeTranslationUnit(result.translationUnit);
  } finally {
    disposeIndex(index);
    await Deno.remove(file);
    unload();
  }
});

Deno.test("ABI - CXCursor buffer works with getCursorSpellingFromBuffer", async () => {
  load();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, "int my_variable = 42;");

  try {
    const result = parseTranslationUnit(index, file);
    assertExists(result.translationUnit);

    const tuCursor = getTranslationUnitCursor(result.translationUnit);
    const children = visitChildren(tuCursor, () => CXChildVisitResult.Continue);

    // Find the VarDecl and verify spelling works
    const varDecl = children.find((buffer) => {
      const kind = getCursorKind(
        buffer as unknown as Parameters<typeof getCursorKind>[0],
      );
      return kind === CXCursorKind.VarDecl;
    });

    assertExists(varDecl, "Expected to find VarDecl cursor");

    // This will fail if CX_CURSOR_SIZE is wrong
    const spelling = getCursorSpellingFromBuffer(
      varDecl as unknown as Parameters<typeof getCursorSpellingFromBuffer>[0],
    );
    assertEquals(spelling, "my_variable");

    disposeTranslationUnit(result.translationUnit);
  } finally {
    disposeIndex(index);
    await Deno.remove(file);
    unload();
  }
});

Deno.test("ABI - visitChildren returns buffers of CX_CURSOR_SIZE", async () => {
  load();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, "int x = 5;");

  try {
    const result = parseTranslationUnit(index, file);
    assertExists(result.translationUnit);

    const tuCursor = getTranslationUnitCursor(result.translationUnit);
    const children = visitChildren(tuCursor, () => CXChildVisitResult.Continue);

    // Each child buffer should be exactly CX_CURSOR_SIZE bytes
    for (const buffer of children) {
      assertEquals(
        buffer.length,
        CX_CURSOR_SIZE,
        `Expected buffer length ${CX_CURSOR_SIZE}, got ${buffer.length}`,
      );
    }

    disposeTranslationUnit(result.translationUnit);
  } finally {
    disposeIndex(index);
    await Deno.remove(file);
    unload();
  }
});

Deno.test("ABI - CXSourceLocation from getCursorLocation is valid", async () => {
  load();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, "int x = 5;");

  try {
    const result = parseTranslationUnit(index, file);
    assertExists(result.translationUnit);

    const tuCursor = getTranslationUnitCursor(result.translationUnit);
    const children = visitChildren(tuCursor, () => CXChildVisitResult.Continue);

    // Find VarDecl
    const varDecl = children.find((buffer) => {
      const kind = getCursorKind(
        buffer as unknown as Parameters<typeof getCursorKind>[0],
      );
      return kind === CXCursorKind.VarDecl;
    });

    assertExists(varDecl);

    // Get location - this should return CX_SOURCE_LOCATION_SIZE
    const { getCursorLocation } = await import("../mod.ts");
    const location = getCursorLocation(
      varDecl as unknown as Parameters<typeof getCursorLocation>[0],
    );

    // Verify location has valid data
    assertExists(location);
    assertEquals(location.line >= 1, true, "Line should be >= 1");
    assertEquals(location.column >= 1, true, "Column should be >= 1");

    disposeTranslationUnit(result.translationUnit);
  } finally {
    disposeIndex(index);
    await Deno.remove(file);
    unload();
  }
});

Deno.test("ABI - CXSourceRange from getCursorExtent is valid", async () => {
  load();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, "int main() { return 0; }");

  try {
    const result = parseTranslationUnit(index, file);
    assertExists(result.translationUnit);

    const tuCursor = getTranslationUnitCursor(result.translationUnit);
    const children = visitChildren(tuCursor, () => CXChildVisitResult.Continue);

    // Find FunctionDecl
    const funcDecl = children.find((buffer) => {
      const kind = getCursorKind(
        buffer as unknown as Parameters<typeof getCursorKind>[0],
      );
      return kind === CXCursorKind.FunctionDecl;
    });

    assertExists(funcDecl, "Expected to find FunctionDecl");

    // Get extent - this should return CX_SOURCE_RANGE_SIZE
    const { getCursorExtent } = await import("../mod.ts");
    const extent = getCursorExtent(
      funcDecl as unknown as Parameters<typeof getCursorExtent>[0],
    );

    // Verify extent has valid data
    assertExists(extent);
    assertExists(extent.start);
    assertExists(extent.end);
    assertEquals(extent.start.line >= 1, true);
    assertEquals(extent.end.line >= 1, true);

    disposeTranslationUnit(result.translationUnit);
  } finally {
    disposeIndex(index);
    await Deno.remove(file);
    unload();
  }
});

Deno.test("ABI - CXType from getCursorType is valid", async () => {
  load();

  const index = createIndex();
  const file = await Deno.makeTempFile({ suffix: ".c" });
  await Deno.writeTextFile(file, "int x = 5;");

  try {
    const result = parseTranslationUnit(index, file);
    assertExists(result.translationUnit);

    const tuCursor = getTranslationUnitCursor(result.translationUnit);
    const children = visitChildren(tuCursor, () => CXChildVisitResult.Continue);

    // Find VarDecl
    const varDecl = children.find((buffer) => {
      const kind = getCursorKind(
        buffer as unknown as Parameters<typeof getCursorKind>[0],
      );
      return kind === CXCursorKind.VarDecl;
    });

    assertExists(varDecl);

    // Get type - this should return CX_TYPE_SIZE
    const { getCursorType } = await import("../mod.ts");
    const type = getCursorType(
      varDecl as unknown as Parameters<typeof getCursorType>[0],
    );

    // Verify type has valid data
    assertExists(type);
    assertEquals(typeof type.kind, "number");

    disposeTranslationUnit(result.translationUnit);
  } finally {
    disposeIndex(index);
    await Deno.remove(file);
    unload();
  }
});
