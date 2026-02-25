/**
 * Tests for CXCursorKind, CXTypeKind, and CXChildVisitResult enum values
 */

import { assertEquals } from "@std/assert";
import { CXChildVisitResult, CXCursorKind, CXTypeKind, load } from "../mod.ts";

// Load once at the start - tests run in sequence and share the loaded library
load();

Deno.test({
  name: "cursor kind - enum values",
  fn() {
    // Test some common cursor kind values (LLVM 20 values)
    assertEquals(CXCursorKind.StructDecl, 2);
    assertEquals(CXCursorKind.FunctionDecl, 8);
    assertEquals(CXCursorKind.VarDecl, 9);
    assertEquals(CXCursorKind.TypedefDecl, 20);
    assertEquals(CXCursorKind.EnumDecl, 5);
    assertEquals(CXCursorKind.EnumConstantDecl, 7);
    assertEquals(CXCursorKind.FieldDecl, 6);
    assertEquals(CXCursorKind.ParmDecl, 10);
    assertEquals(CXCursorKind.UnionDecl, 3);
    assertEquals(CXCursorKind.TranslationUnit, 350);
    assertEquals(CXCursorKind.IntegerLiteral, 115);
    assertEquals(CXCursorKind.StringLiteral, 116);
    assertEquals(CXCursorKind.CallExpr, 114);
  },
});

Deno.test({
  name: "type kind - enum values",
  fn() {
    // Test some common type kind values (LLVM 20 values)
    assertEquals(CXTypeKind.Void, 2);
    assertEquals(CXTypeKind.Bool, 3);
    assertEquals(CXTypeKind.Char_U, 4);
    assertEquals(CXTypeKind.UChar, 5);
    assertEquals(CXTypeKind.Char16, 6);
    assertEquals(CXTypeKind.Char32, 7);
    assertEquals(CXTypeKind.UShort, 8);
    assertEquals(CXTypeKind.UInt, 9);
    assertEquals(CXTypeKind.ULong, 10);
    assertEquals(CXTypeKind.UInt128, 12);
    assertEquals(CXTypeKind.Long, 18);
    assertEquals(CXTypeKind.LongLong, 19);
    assertEquals(CXTypeKind.Float, 21);
    assertEquals(CXTypeKind.Double, 22);
    assertEquals(CXTypeKind.Pointer, 101);
    assertEquals(CXTypeKind.Record, 105);
    assertEquals(CXTypeKind.Enum, 106);
    assertEquals(CXTypeKind.Typedef, 107);
    assertEquals(CXTypeKind.ConstantArray, 112);
    assertEquals(CXTypeKind.IncompleteArray, 114);
    assertEquals(CXTypeKind.FunctionProto, 111);
    assertEquals(CXTypeKind.FunctionNoProto, 110);
    assertEquals(CXTypeKind.Elaborated, 149);
    assertEquals(CXTypeKind.Auto, 118);
  },
});

Deno.test({
  name: "CXChildVisitResult - enum values",
  fn() {
    // Test CXChildVisitResult enum values
    assertEquals(CXChildVisitResult.Continue, 0);
    assertEquals(CXChildVisitResult.Break, 1);
    assertEquals(CXChildVisitResult.Recurse, 2);
  },
});
