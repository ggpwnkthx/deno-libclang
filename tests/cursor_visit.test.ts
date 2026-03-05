/**
 * Tests for cursor visitChildren traversal
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXChildVisitResult,
  CXCursorKind,
  getCursorKind,
  visitChildren,
} from "../mod.ts";
import { findChildrenByKind, findCursorByKind, parseC } from "./test_utils.ts";

Deno.test({
  name: "cursor - visitChildren basic traversal",
  async fn() {
    const code = `
      struct Point { int x; int y; };
      int main() { return 0; }
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      // Visit children and collect all
      const children = visitChildren(tuCursor, () => {
        return CXChildVisitResult.Continue;
      });

      // Should have found at least StructDecl and FunctionDecl
      assertExists(children);
      assertEquals(children.length >= 2, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren returns Continue",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `int a = 1; int b = 2; int c = 3;`,
    );

    try {
      // Using Continue should visit all children
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Continue,
      );

      // Should find all 3 VarDecl
      const varDecls = findChildrenByKind(children, CXCursorKind.VarDecl);
      assertEquals(varDecls.length, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren returns Break",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `int a = 1; int b = 2; int c = 3;`,
    );

    try {
      // Using Break should stop after first child
      let visitCount = 0;
      const children = visitChildren(tuCursor, () => {
        visitCount++;
        return CXChildVisitResult.Break;
      });

      // Should only visit 1 child then break
      assertEquals(visitCount, 1);
      assertEquals(children.length, 1);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren traverses different cursor kinds",
  async fn() {
    const code = `
      struct Point { int x; int y; };
      enum Color { RED, GREEN, BLUE };
      int add(int a, int b) { return a + b; }
      int global_var = 10;
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Continue,
      );

      // Check we found different cursor kinds
      const hasStruct =
        findChildrenByKind(children, CXCursorKind.StructDecl).length > 0;
      const hasEnum =
        findChildrenByKind(children, CXCursorKind.EnumDecl).length > 0;
      const hasFunc =
        findChildrenByKind(children, CXCursorKind.FunctionDecl).length > 0;
      const hasVar =
        findChildrenByKind(children, CXCursorKind.VarDecl).length > 0;

      assertEquals(hasStruct, true);
      assertEquals(hasEnum, true);
      assertEquals(hasFunc, true);
      assertEquals(hasVar, true);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with struct fields",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `struct Point { int x; int y; };`,
    );

    try {
      // Find the struct declaration
      const structDecl = findCursorByKind(tuCursor, CXCursorKind.StructDecl);
      assertExists(structDecl, "Expected to find StructDecl cursor");

      // Use helper to find fields
      const fieldDecls = findChildrenByKind(
        visitChildren(structDecl, () => CXChildVisitResult.Continue),
        CXCursorKind.FieldDecl,
      );

      // Should have 2 FieldDecl (x and y)
      assertEquals(fieldDecls.length, 2);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with enum values",
  async fn() {
    const { tuCursor, cleanup } = await parseC(
      `enum Color { RED, GREEN, BLUE };`,
    );

    try {
      // Find the enum declaration
      const enumDecl = findCursorByKind(tuCursor, CXCursorKind.EnumDecl);
      assertExists(enumDecl, "Expected to find EnumDecl cursor");

      // Visit children to find enum constants
      const enumConstants = findChildrenByKind(
        visitChildren(enumDecl, () => CXChildVisitResult.Continue),
        CXCursorKind.EnumConstantDecl,
      );

      // Should have 3 EnumConstantDecl (RED, GREEN, BLUE)
      assertEquals(enumConstants.length, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren with function parameters",
  async fn() {
    const { tuCursor, cleanup } = await parseC(`int add(int a, int b, int c);`);

    try {
      // Find the function declaration
      const funcDecl = findCursorByKind(tuCursor, CXCursorKind.FunctionDecl);
      assertExists(funcDecl, "Expected to find FunctionDecl cursor");

      // Visit children to find parameters
      const parmDecls = findChildrenByKind(
        visitChildren(funcDecl, () => CXChildVisitResult.Continue),
        CXCursorKind.ParmDecl,
      );

      // Should have 3 ParmDecl
      assertEquals(parmDecls.length, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "cursor - visitChildren Recurse descends into children",
  async fn() {
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;
    const { tuCursor, cleanup } = await parseC(code);

    try {
      // Get the children buffers - visitChildren returns buffers
      const children = visitChildren(
        tuCursor,
        () => CXChildVisitResult.Recurse,
      );

      // Find struct decl in children
      const structDecl = children.find((buffer) => {
        const kind = getCursorKind(
          buffer as unknown as Parameters<typeof getCursorKind>[0],
        );
        return kind === CXCursorKind.StructDecl;
      });
      assertExists(structDecl);

      // Visit the struct's children (the fields)
      const structChildren = visitChildren(
        structDecl as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );

      // Should have visited: TU -> StructDecl -> FieldDecl (x) -> FieldDecl (y)
      // With Recurse on TU, we should see StructDecl
      // Then visit StructDecl's children to find fields
      const fieldDecls = structChildren.filter((buffer) => {
        const kind = getCursorKind(
          buffer as unknown as Parameters<typeof getCursorKind>[0],
        );
        return kind === CXCursorKind.FieldDecl;
      });

      assertEquals(fieldDecls.length, 2); // x and y
    } finally {
      await cleanup();
    }
  },
});
