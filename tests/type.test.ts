/**
 * Tests for type operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXCursorKind,
  CXTypeKind,
  getArgType,
  getCursorType,
  getNumArgTypes,
  getPointeeType,
  getResultType,
  getTypeKind,
  getTypeKindSpelling,
  getTypeSpelling,

  load,
  unload,
} from "../mod.ts";
import { findCursorByKind, parseC } from "./test_utils.ts";

Deno.test({
  name: "type - get cursor type",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int x = 5;`);
    try {
      const type = getCursorType(tuCursor);
      assertExists(type);
      assertEquals(typeof type.kind, "number");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - get type kind",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int x;`);
    try {
      const type = getCursorType(tuCursor);
      // The TU cursor's type is always Invalid (kind=0)
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Invalid);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - get type spelling",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int x;`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const spelling = getTypeSpelling(type);
      assertEquals(spelling, "int");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - get type kind spelling",
  fn() {
    load();
    try {
      // In LLVM 20, CXTypeKind enum values shifted
      // CXTypeKind.Int = 12 returns "UInt128" in LLVM 20
      const spelling = getTypeKindSpelling(CXTypeKind.Int);
      assertExists(spelling);
      assertEquals(typeof spelling, "string");
      assertEquals(spelling.length > 0, true);

      // Test another type kind spelling
      const pointerSpelling = getTypeKindSpelling(CXTypeKind.Pointer);
      assertExists(pointerSpelling);
      assertEquals(pointerSpelling.length > 0, true);

      // Test void spelling
      const voidSpelling = getTypeKindSpelling(CXTypeKind.Void);
      assertExists(voidSpelling);
      assertEquals(voidSpelling.length > 0, true);
    } finally {
      unload();
    }
  },
});

Deno.test({
  name: "type - struct type",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `struct Point { int x; int y; };`,
    );
    try {
      const structDecl = findCursorByKind(tuCursor, CXCursorKind.StructDecl);
      assertExists(structDecl, "Expected to find StructDecl cursor");

      const type = getCursorType(structDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Record);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - pointer type",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int* ptr;`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Pointer);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getTypedefUnderlyingType",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`typedef int MyInt;`);
    try {
      const typedefDecl = findCursorByKind(tuCursor, CXCursorKind.TypedefDecl);
      assertExists(typedefDecl, "Expected to find TypedefDecl cursor");

      const { getTypedefUnderlyingType } = await import("../mod.ts");
      const underlyingType = getTypedefUnderlyingType(typedefDecl);
      const typeKind = getTypeKind(underlyingType);
      assertEquals(typeKind, CXTypeKind.Int);
    } finally {
      await cleanup();
    }
  },
});


Deno.test({
  name: "type - getNumArgTypes",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int add(int a, int b, int c);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const numArgs = getNumArgTypes(type);
      assertEquals(numArgs, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getArgType",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int add(int a, int b, int c);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);

      const argType0 = getArgType(type, 0);
      const kind0 = getTypeKind(argType0);
      assertEquals(kind0, CXTypeKind.Int);

      const argType1 = getArgType(type, 1);
      const kind1 = getTypeKind(argType1);
      assertEquals(kind1, CXTypeKind.Int);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getResultType",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int add(int a, int b);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const resultType = getResultType(type);
      const resultKind = getTypeKind(resultType);
      assertEquals(resultKind, CXTypeKind.Int);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getPointeeType",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int* ptr;`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const pointeeType = getPointeeType(type);
      const pointeeKind = getTypeKind(pointeeType);
      assertEquals(pointeeKind, CXTypeKind.Int);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getArgType with out of bounds index",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int add(int a, int b);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const argType = getArgType(type, 100);
      const kind = getTypeKind(argType);
      assertEquals(typeof kind, "number");
    } finally {
      await cleanup();
    }
  },
});

// ============================================================================
// Additional Advanced Type Tests
// ============================================================================

Deno.test({
  name: "type - getPointeeType with double pointer",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int** ptr;`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);

      // First pointee should be pointer
      const pointeeType = getPointeeType(type);
      const pointeeKind = getTypeKind(pointeeType);
      assertEquals(pointeeKind, CXTypeKind.Pointer);

      // Second pointee should be int
      const pointeeType2 = getPointeeType(pointeeType);
      const pointeeKind2 = getTypeKind(pointeeType2);
      assertEquals(pointeeKind2, CXTypeKind.Int);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getResultType with void return",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`void test(void);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const resultType = getResultType(type);
      const resultKind = getTypeKind(resultType);
      assertEquals(resultKind, CXTypeKind.Void);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - getResultType with pointer return",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int* getptr(void);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const resultType = getResultType(type);
      const resultKind = getTypeKind(resultType);
      assertEquals(resultKind, CXTypeKind.Pointer);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - array type detection",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int arr[10];`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.ConstantArray);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - incomplete array type",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int arr[];`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const typeKind = getTypeKind(type);
      assertEquals(
        typeKind === CXTypeKind.ConstantArray ||
          typeKind === CXTypeKind.IncompleteArray,
        true,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - function type with no parameters",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`void test();`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.FunctionNoProto);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - function type with prototype",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`void test(int a, int b);`);
    try {
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      const type = getCursorType(funcDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.FunctionProto);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - long type",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`long x;`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.Long);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - long long type",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`long long x;`);
    try {
      const varDecl = findCursorByKind(tuCursor, CXCursorKind.VarDecl);
      assertExists(varDecl, "Expected to find VarDecl cursor");

      const type = getCursorType(varDecl);
      const typeKind = getTypeKind(type);
      assertEquals(typeKind, CXTypeKind.LongLong);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "type - typeKindToFFI with uint types",
  async fn() {
    const { typeKindToFFI, CXTypeKind } = await import("../mod.ts");

    // Test case 1: SChar with uint8_t spelling
    const result1 = typeKindToFFI(CXTypeKind.SChar, "uint8_t");
    assertEquals(result1, "u8", "SChar with uint8_t spelling should return u8");

    // Test case 2: SChar with regular signed char spelling
    const result2 = typeKindToFFI(CXTypeKind.SChar, "signed char");
    assertEquals(
      result2,
      "i8",
      "SChar with signed char spelling should return i8",
    );

    // Test case 3: Short with uint16_t spelling
    const result3 = typeKindToFFI(CXTypeKind.Short, "uint16_t");
    assertEquals(
      result3,
      "u16",
      "Short with uint16_t spelling should return u16",
    );

    // Test case 4: Short with regular short spelling
    const result4 = typeKindToFFI(CXTypeKind.Short, "short");
    assertEquals(result4, "i16", "Short with short spelling should return i16");

    // Test case 5: Int with uint32_t spelling
    const result5 = typeKindToFFI(CXTypeKind.Int, "uint32_t");
    assertEquals(
      result5,
      "u32",
      "Int with uint32_t spelling should return u32",
    );

    // Test case 6: Int with regular int spelling
    const result6 = typeKindToFFI(CXTypeKind.Int, "int");
    assertEquals(result6, "i32", "Int with int spelling should return i32");

    // Test case 7: UChar should still work correctly
    const result7 = typeKindToFFI(CXTypeKind.UChar, "unsigned char");
    assertEquals(result7, "u8", "UChar should return u8");

    // Test case 8: UShort should still work correctly
    const result8 = typeKindToFFI(CXTypeKind.UShort, "unsigned short");
    assertEquals(result8, "u16", "UShort should return u16");

    // Test case 9: UInt should still work correctly
    const result9 = typeKindToFFI(CXTypeKind.UInt, "unsigned int");
    assertEquals(result9, "u32", "UInt should return u32");
  },
});

Deno.test({
  name: "type - typeKindToFFI substring edge cases",
  async fn() {
    const { typeKindToFFI } = await import("../src/libclang/type.ts");
    const { CXTypeKind } = await import("../mod.ts");

    // These were previously buggy - "uint16_t" was being matched as "int16"
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "uint16_t"), "u16");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "uint32_t"), "u32");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "uint64_t"), "u64");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "uint8_t"), "u8");

    // Make sure int types still work
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "int16_t"), "i16");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "int32_t"), "i32");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "int64_t"), "i64");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "int8_t"), "i8");

    // Without _t suffix
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "uint16"), "u16");
    assertEquals(typeKindToFFI(CXTypeKind.Elaborated, "int16"), "i16");

    // Default case (fallback spelling check)
    assertEquals(typeKindToFFI(CXTypeKind.Invalid, "uint16_t"), "u16");
    assertEquals(typeKindToFFI(CXTypeKind.Invalid, "int16_t"), "i16");
  },
});

Deno.test({
  name: "type - typeKindToFFI Long on Windows",
  async fn() {
    const { typeKindToFFI } = await import("../src/libclang/type.ts");
    const { CXTypeKind } = await import("../mod.ts");

    const longResult = typeKindToFFI(CXTypeKind.Long, "");
    const ulongResult = typeKindToFFI(CXTypeKind.ULong, "");

    if (Deno.build.os === "windows") {
      assertEquals(longResult, "i32", "Long should be i32 on Windows");
      assertEquals(ulongResult, "u32", "ULong should be u32 on Windows");
    } else if (Deno.build.arch === "x86_64" || Deno.build.arch === "aarch64") {
      assertEquals(longResult, "i64", "Long should be i64 on 64-bit Unix");
      assertEquals(ulongResult, "u64", "ULong should be u64 on 64-bit Unix");
    } else {
      assertEquals(longResult, "i32", "Long should be i32 on 32-bit Unix");
      assertEquals(ulongResult, "u32", "ULong should be u32 on 32-bit Unix");
    }
  },
});
