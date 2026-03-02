/**
 * Enum value tests for libclang (v20+)
 *
 * These are *exact value* assertions (not just structural checks).
 * If these fail, your enums do not match clang-c/Index.h and your
 * traversal/type lowering will be unreliable.
 */

import { assert, assertEquals } from "@std/assert";
import {
  CXChildVisitResult,
  CXCursorKind,
  CXTypeKind,
  getCursorKind,
  visitChildren,
} from "../mod.ts";
import { parseC } from "./test_utils.ts";

type EnumObject = Record<string, unknown>;

function assertEnumValue(enumObj: EnumObject, key: string, expected: number) {
  const actual = enumObj[key];
  assertEquals(
    actual,
    expected,
    `Expected ${key} to be ${expected}, got ${String(actual)}`,
  );
}

function assertEnumReverseMapping(
  enumObj: EnumObject,
  key: string,
  expected: number,
) {
  // TS numeric enums have reverse mapping: Enum[expected] => "Key"
  const reverse = enumObj[String(expected)];
  assertEquals(
    reverse,
    key,
    `Expected reverse mapping ${expected} => "${key}", got ${String(reverse)}`,
  );
}

Deno.test({
  name: "CXChildVisitResult values match clang-c/Index.h",
  fn() {
    const e = CXChildVisitResult as unknown as EnumObject;

    // enum CXChildVisitResult { Break=0, Continue=1, Recurse=2 }
    assertEnumValue(e, "Break", 0);
    assertEnumValue(e, "Continue", 1);
    assertEnumValue(e, "Recurse", 2);

    // Reverse mapping sanity
    assertEnumReverseMapping(e, "Break", 0);
    assertEnumReverseMapping(e, "Continue", 1);
    assertEnumReverseMapping(e, "Recurse", 2);
  },
});

Deno.test({
  name: "CXTypeKind values match clang-c/Index.h (selected sentinels)",
  fn() {
    const e = CXTypeKind as unknown as EnumObject;

    // Builtins
    assertEnumValue(e, "Invalid", 0);
    assertEnumValue(e, "Unexposed", 1);
    assertEnumValue(e, "Void", 2);
    assertEnumValue(e, "Bool", 3);
    assertEnumValue(e, "Char_U", 4);
    assertEnumValue(e, "UChar", 5);
    assertEnumValue(e, "UShort", 8);
    assertEnumValue(e, "UInt", 9);
    assertEnumValue(e, "ULong", 10);
    assertEnumValue(e, "ULongLong", 11);
    assertEnumValue(e, "Char_S", 13);
    assertEnumValue(e, "SChar", 14);
    assertEnumValue(e, "Short", 16);
    assertEnumValue(e, "Int", 17);
    assertEnumValue(e, "Long", 18);
    assertEnumValue(e, "LongLong", 19);
    assertEnumValue(e, "Float", 21);
    assertEnumValue(e, "Double", 22);

    // Non-builtin / structural kinds (these are the ones commonly mis-modeled)
    assertEnumValue(e, "Pointer", 101);
    assertEnumValue(e, "Record", 105);
    assertEnumValue(e, "Enum", 106);
    assertEnumValue(e, "Typedef", 107);
    assertEnumValue(e, "FunctionNoProto", 110);
    assertEnumValue(e, "FunctionProto", 111);
    assertEnumValue(e, "ConstantArray", 112);
    assertEnumValue(e, "Auto", 118);
    assertEnumValue(e, "Elaborated", 119);

    // Important: Attributed is *not* 121 in v20+; 121 starts OpenCL image kinds.
    assertEnumValue(e, "Attributed", 163);

    // Reverse mapping spot-check (avoid keys that might be aliased elsewhere)
    assertEnumReverseMapping(e, "Pointer", 101);
    assertEnumReverseMapping(e, "Elaborated", 119);
    assertEnumReverseMapping(e, "Attributed", 163);
  },
});

Deno.test({
  name: "CXCursorKind values match clang-c/Index.h (selected sentinels)",
  fn() {
    const e = CXCursorKind as unknown as EnumObject;

    // Decls (very common)
    assertEnumValue(e, "UnexposedDecl", 1);
    assertEnumValue(e, "StructDecl", 2);
    assertEnumValue(e, "UnionDecl", 3);
    assertEnumValue(e, "ClassDecl", 4);
    assertEnumValue(e, "EnumDecl", 5);
    assertEnumValue(e, "FieldDecl", 6);
    assertEnumValue(e, "EnumConstantDecl", 7);
    assertEnumValue(e, "FunctionDecl", 8);
    assertEnumValue(e, "VarDecl", 9);
    assertEnumValue(e, "ParmDecl", 10);
    assertEnumValue(e, "TypedefDecl", 20);

    // Exprs
    assertEnumValue(e, "CallExpr", 114);
    assertEnumValue(e, "IntegerLiteral", 115);
    assertEnumValue(e, "StringLiteral", 116);

    // Translation unit root
    assertEnumValue(e, "TranslationUnit", 350);

    // Reverse mapping spot-check (avoid any known aliases)
    assertEnumReverseMapping(e, "StructDecl", 2);
    assertEnumReverseMapping(e, "FunctionDecl", 8);
    assertEnumReverseMapping(e, "CallExpr", 114);
    assertEnumReverseMapping(e, "TranslationUnit", 350);
  },
});

Deno.test({
  name:
    "visitChildren honors CXChildVisitResult numeric semantics (Break/Continue/Recurse)",
  permissions: { ffi: true, read: true, write: true, env: true },
  async fn() {
    // TU has 3 top-level VarDecls and one function with nested nodes.
    const { tuCursor, cleanup } = await parseC(`
      int a = 1;
      int b = 2;
      int c = 3;
      int add(int x, int y) { return x + y; }
    `);

    try {
      // 1) Continue (=1) should visit all direct TU children (at least 4 here).
      let continueCount = 0;
      visitChildren(tuCursor, () => {
        continueCount++;
        return CXChildVisitResult.Continue;
      });
      assert(
        continueCount >= 4,
        `Expected >= 4 TU children with Continue; got ${continueCount}`,
      );

      // 2) Break (=0) should stop after first child.
      let breakCount = 0;
      visitChildren(tuCursor, () => {
        breakCount++;
        return CXChildVisitResult.Break;
      });
      assertEquals(breakCount, 1);

      // 3) Recurse (=2) should traverse *into* children when used on a non-leaf.
      // Get the list of child buffers and find the FunctionDecl buffer.
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Continue,
      );
      const funcBuffer = children.find((buffer) => {
        const kind = getCursorKind(
          buffer as unknown as Parameters<typeof getCursorKind>[0],
        );
        return kind === CXCursorKind.FunctionDecl;
      });
      assert(
        funcBuffer !== undefined,
        "Expected to find a FunctionDecl buffer",
      );

      // Direct children count (Continue only)
      let directCount = 0;
      visitChildren(funcBuffer as never, () => {
        directCount++;
        return CXChildVisitResult.Continue;
      });

      // Recursive traversal count (Recurse everywhere)
      let recurseCount = 0;
      visitChildren(funcBuffer as never, () => {
        recurseCount++;
        return CXChildVisitResult.Recurse;
      });

      assert(
        recurseCount > directCount,
        `Expected Recurse traversal (${recurseCount}) to visit more than direct children (${directCount})`,
      );

      // Bonus: numeric literals must align (in case someone returns raw numbers).
      assertEquals(CXChildVisitResult.Break, 0);
      assertEquals(CXChildVisitResult.Continue, 1);
      assertEquals(CXChildVisitResult.Recurse, 2);
    } finally {
      await cleanup();
    }
  },
});
