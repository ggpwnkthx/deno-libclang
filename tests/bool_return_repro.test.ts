/**
 * Regression tests for `_Bool` (C `bool` from <stdbool.h>) as a function
 * return type in cursor/type plumbing.
 *
 * Historically, `clang_getCursorResultType` followed by `clang_getTypeSpelling`
 * could return "int" / `CXTypeKind.Int` for functions whose return type is
 * `_Bool`, and `clang_visitChildren` on the same cursor could fail to surface
 * any `ParmDecl` children. This locks in correct behavior for the 15
 * declarations from DuckDB v1.5.5 that exhibit the failure mode.
 */

import { assert, assertEquals } from "@std/assert";
import {
  collectDeclarations,
  CXChildVisitResult,
  CXCursorKind,
  CXTypeKind,
  getCursorArgument,
  getCursorKind,
  getCursorNumArguments,
  getCursorSpelling,
  getCursorSpellingFromBuffer,
  getCursorType,
  getNumArgTypes,
  getResultType,
  getTypeKind,
  getTypeKindSpelling,
  getTypeSpelling,
  visitChildren,
} from "../mod.ts";
import { parseCFile } from "./test_utils.ts";

/**
 * Expected parameter arity per declaration (matches DuckDB v1.5.5).
 */
const EXPECTED_ARITY: Readonly<Record<string, number>> = {
  duckdb_error_data_has_error: 1,
  duckdb_result_is_streaming: 1,
  duckdb_value_boolean: 3,
  duckdb_value_is_null: 3,
  duckdb_get_bool: 1,
  duckdb_string_is_inlined: 1,
  duckdb_is_finite_date: 1,
  duckdb_is_finite_timestamp: 1,
  duckdb_is_finite_timestamp_s: 1,
  duckdb_is_finite_timestamp_ms: 1,
  duckdb_is_finite_timestamp_ns: 1,
  duckdb_pending_execution_is_finished: 1,
  duckdb_task_state_is_finished: 1,
  duckdb_execution_is_finished: 1,
  duckdb_expression_is_foldable: 1,
  duckdb_control_int_return: 1,
  duckdb_control_bool_return: 1,
};

/**
 * Expected parameter spellings (per DuckDB v1.5.5).
 */
const EXPECTED_PARAM_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  duckdb_error_data_has_error: ["error_data"],
  duckdb_result_is_streaming: ["result"],
  duckdb_value_boolean: ["result", "col", "row"],
  duckdb_value_is_null: ["result", "col", "row"],
  duckdb_get_bool: ["val"],
  duckdb_string_is_inlined: ["string"],
  duckdb_is_finite_date: ["date"],
  duckdb_is_finite_timestamp: ["ts"],
  duckdb_is_finite_timestamp_s: ["ts"],
  duckdb_is_finite_timestamp_ms: ["ts"],
  duckdb_is_finite_timestamp_ns: ["ts"],
  duckdb_pending_execution_is_finished: ["pending_state"],
  duckdb_task_state_is_finished: ["state"],
  duckdb_execution_is_finished: ["con"],
  duckdb_expression_is_foldable: ["expr"],
  duckdb_control_int_return: ["x"],
  duckdb_control_bool_return: ["b"],
};

interface FuncSummary {
  name: string;
  resultKind: number;
  resultKindSpelling: string;
  resultSpelling: string;
  numArgs: number;
  paramNames: string[];
}

function summarizeFunctionDecls(
  children: Uint8Array[],
): FuncSummary[] {
  const summaries: FuncSummary[] = [];
  for (const child of children) {
    const kind = getCursorKind(
      child as unknown as Parameters<typeof getCursorKind>[0],
    );
    if (kind !== CXCursorKind.FunctionDecl) continue;

    const name = getCursorSpelling(
      child as unknown as Parameters<typeof getCursorSpelling>[0],
    );
    if (!name) continue;

    const funcType = getCursorType(
      child as unknown as Parameters<typeof getCursorType>[0],
    );
    const returnType = getResultType(funcType);
    const resultKind = getTypeKind(returnType);
    const resultKindSpelling = getTypeKindSpelling(resultKind);
    const resultSpelling = getTypeSpelling(returnType);
    const numArgs = getNumArgTypes(funcType);

    const paramChildren = visitChildren(
      child as unknown as Parameters<typeof visitChildren>[0],
      () => CXChildVisitResult.Continue,
    );
    const paramNames: string[] = [];
    for (const pc of paramChildren) {
      const pk = getCursorKind(
        pc as unknown as Parameters<typeof getCursorKind>[0],
      );
      if (pk !== CXCursorKind.ParmDecl) continue;
      const pn = getCursorSpellingFromBuffer(
        pc as unknown as Parameters<typeof getCursorSpellingFromBuffer>[0],
      );
      paramNames.push(pn);
    }

    summaries.push({
      name,
      resultKind,
      resultKindSpelling,
      resultSpelling,
      numArgs,
      paramNames,
    });
  }
  return summaries;
}

Deno.test({
  name:
    "bool repro - all 15 bool-returning fns report Bool kind + _Bool spelling",
  async fn() {
    const { tuCursor, cleanup } = await parseCFile(
      "tests/fixtures/duckdb_subset_bool.h",
    );
    try {
      const children = visitChildren(
        tuCursor as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );
      const summaries = summarizeFunctionDecls(children);
      const boolFns = summaries.filter((s) =>
        s.name.startsWith("duckdb_") &&
        s.name !== "duckdb_control_int_return" &&
        s.name !== "duckdb_control_bool_return"
      );
      assertEquals(
        boolFns.length,
        15,
        "Expected 15 bool-returning declarations in the fixture",
      );

      for (const fn of boolFns) {
        assertEquals(
          fn.resultKind,
          CXTypeKind.Bool,
          `${fn.name}: expected Bool kind, got ${fn.resultKind} (${fn.resultKindSpelling})`,
        );
        assert(
          fn.resultSpelling === "_Bool" || fn.resultSpelling === "bool",
          `${fn.name}: expected "_Bool" or "bool" spelling, got "${fn.resultSpelling}"`,
        );
      }
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name:
    "bool repro - all 15 bool-returning fns yield expected ParmDecl arity + names",
  async fn() {
    const { tuCursor, cleanup } = await parseCFile(
      "tests/fixtures/duckdb_subset_bool.h",
    );
    try {
      const children = visitChildren(
        tuCursor as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );
      const summaries = summarizeFunctionDecls(children);

      for (const fn of summaries) {
        const expectedArity = EXPECTED_ARITY[fn.name];
        assert(
          expectedArity !== undefined,
          `Unexpected declaration in fixture: ${fn.name}`,
        );
        assertEquals(
          fn.numArgs,
          expectedArity,
          `${fn.name}: clang_getNumArgTypes returned ${fn.numArgs}, expected ${expectedArity}`,
        );
        assertEquals(
          fn.paramNames.length,
          expectedArity,
          `${fn.name}: visitChildren yielded ${fn.paramNames.length} ParmDecl cursors, expected ${expectedArity}`,
        );

        const expectedNames = EXPECTED_PARAM_SPELLINGS[fn.name];
        assert(
          expectedNames !== undefined,
          `Missing expected params for ${fn.name}`,
        );
        assertEquals(
          fn.paramNames,
          [...expectedNames],
          `${fn.name}: parameter names mismatch`,
        );
      }
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "bool repro - control declarations round-trip correctly",
  async fn() {
    const { tuCursor, cleanup } = await parseCFile(
      "tests/fixtures/duckdb_subset_bool.h",
    );
    try {
      const children = visitChildren(
        tuCursor as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );
      const summaries = summarizeFunctionDecls(children);

      const intControl = summaries.find((s) =>
        s.name === "duckdb_control_int_return"
      );
      assert(intControl !== undefined, "duckdb_control_int_return missing");
      assertEquals(intControl.resultKind, CXTypeKind.Int);
      assertEquals(intControl.resultSpelling, "int");
      assertEquals(intControl.numArgs, 1);
      assertEquals(intControl.paramNames, ["x"]);

      const boolParamControl = summaries.find((s) =>
        s.name === "duckdb_control_bool_return"
      );
      assert(
        boolParamControl !== undefined,
        "duckdb_control_bool_return missing",
      );
      assertEquals(boolParamControl.resultKind, CXTypeKind.Bool);
      assert(
        boolParamControl.resultSpelling === "_Bool" ||
          boolParamControl.resultSpelling === "bool",
      );
      assertEquals(boolParamControl.numArgs, 1);
      assertEquals(boolParamControl.paramNames, ["b"]);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name:
    "bool repro - collectDeclarations lowers all 15 fns to u8 return + correct params",
  async fn() {
    const { tu, cleanup } = await parseCFile(
      "tests/fixtures/duckdb_subset_bool.h",
    );
    try {
      const warnings: string[] = [];
      const data = collectDeclarations(
        tu,
        [],
        [
          "duckdb_database",
          "duckdb_connection",
          "duckdb_result",
          "duckdb_value",
          "duckdb_error_data",
          "duckdb_string_t",
          "duckdb_date",
          "duckdb_timestamp",
          "duckdb_timestamp_s",
          "duckdb_timestamp_ms",
          "duckdb_timestamp_ns",
          "duckdb_pending_state",
          "duckdb_task_state",
          "duckdb_expression",
        ],
        warnings,
      );
      const fnsByName = new Map(data.functions.map((f) => [f.name, f]));

      const boolNames = [
        "duckdb_error_data_has_error",
        "duckdb_result_is_streaming",
        "duckdb_value_boolean",
        "duckdb_value_is_null",
        "duckdb_get_bool",
        "duckdb_string_is_inlined",
        "duckdb_is_finite_date",
        "duckdb_is_finite_timestamp",
        "duckdb_is_finite_timestamp_s",
        "duckdb_is_finite_timestamp_ms",
        "duckdb_is_finite_timestamp_ns",
        "duckdb_pending_execution_is_finished",
        "duckdb_task_state_is_finished",
        "duckdb_execution_is_finished",
        "duckdb_expression_is_foldable",
      ];

      for (const name of boolNames) {
        const fn = fnsByName.get(name);
        assert(fn !== undefined, `${name} not collected`);
        assertEquals(fn.returnType, "u8", `${name}: returnType should be u8`);
        const arity = EXPECTED_ARITY[name];
        assertEquals(
          fn.parameters.length,
          arity,
          `${name}: parameters.length mismatch`,
        );
        const expected = EXPECTED_PARAM_SPELLINGS[name];
        for (let i = 0; i < arity; i++) {
          assertEquals(
            fn.parameters[i].name,
            expected[i],
            `${name}: parameter ${i} name mismatch`,
          );
        }
      }

      const intControl = fnsByName.get("duckdb_control_int_return");
      assert(intControl !== undefined);
      assertEquals(intControl.returnType, "i32");
      assertEquals(intControl.parameters.length, 1);
      assertEquals(intControl.parameters[0].name, "x");

      const boolParamControl = fnsByName.get("duckdb_control_bool_return");
      assert(boolParamControl !== undefined);
      assertEquals(boolParamControl.returnType, "u8");
      assertEquals(boolParamControl.parameters.length, 1);
      assertEquals(boolParamControl.parameters[0].name, "b");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name:
    "bool repro - direct cursor argument API reports correct arity for bool fns",
  async fn() {
    const { tuCursor, cleanup } = await parseCFile(
      "tests/fixtures/duckdb_subset_bool.h",
    );
    try {
      const children = visitChildren(
        tuCursor as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );
      for (const child of children) {
        const kind = getCursorKind(
          child as unknown as Parameters<typeof getCursorKind>[0],
        );
        if (kind !== CXCursorKind.FunctionDecl) continue;
        const name = getCursorSpelling(
          child as unknown as Parameters<typeof getCursorSpelling>[0],
        );
        if (!name) continue;
        const expected = EXPECTED_ARITY[name];
        if (expected === undefined) continue;

        const directCount = getCursorNumArguments(
          child as unknown as Parameters<typeof getCursorNumArguments>[0],
        );
        assertEquals(
          directCount,
          expected,
          `${name}: getCursorNumArguments returned ${directCount}, expected ${expected}`,
        );

        for (let i = 0; i < directCount; i++) {
          const argCursor = getCursorArgument(
            child as unknown as Parameters<typeof getCursorArgument>[0],
            i,
          );
          const argKind = getCursorKind(
            argCursor as unknown as Parameters<typeof getCursorKind>[0],
          );
          assertEquals(
            argKind,
            CXCursorKind.ParmDecl,
            `${name}: argument ${i} should be ParmDecl, got ${argKind}`,
          );
          const argSpelling = getCursorSpelling(
            argCursor as unknown as Parameters<typeof getCursorSpelling>[0],
          );
          const expectedNames = EXPECTED_PARAM_SPELLINGS[name];
          assert(expectedNames !== undefined);
          assertEquals(
            argSpelling,
            expectedNames[i],
            `${name}: argument ${i} spelling mismatch`,
          );
        }
      }
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name:
    "bool repro - visitChildren + direct API both yield the same ParmDecl set",
  async fn() {
    const { tuCursor, cleanup } = await parseCFile(
      "tests/fixtures/duckdb_subset_bool.h",
    );
    try {
      const children = visitChildren(
        tuCursor as unknown as Parameters<typeof visitChildren>[0],
        () => CXChildVisitResult.Continue,
      );
      for (const child of children) {
        const kind = getCursorKind(
          child as unknown as Parameters<typeof getCursorKind>[0],
        );
        if (kind !== CXCursorKind.FunctionDecl) continue;
        const name = getCursorSpelling(
          child as unknown as Parameters<typeof getCursorSpelling>[0],
        );
        if (!name) continue;
        if (EXPECTED_ARITY[name] === undefined) continue;

        const parmChildren = visitChildren(
          child as unknown as Parameters<typeof visitChildren>[0],
          () => CXChildVisitResult.Continue,
        );
        const fromVisit: string[] = [];
        for (const pc of parmChildren) {
          const pk = getCursorKind(
            pc as unknown as Parameters<typeof getCursorKind>[0],
          );
          if (pk !== CXCursorKind.ParmDecl) continue;
          fromVisit.push(
            getCursorSpellingFromBuffer(
              pc as unknown as Parameters<
                typeof getCursorSpellingFromBuffer
              >[0],
            ),
          );
        }

        const directCount = getCursorNumArguments(
          child as unknown as Parameters<typeof getCursorNumArguments>[0],
        );
        const fromDirect: string[] = [];
        for (let i = 0; i < directCount; i++) {
          const arg = getCursorArgument(
            child as unknown as Parameters<typeof getCursorArgument>[0],
            i,
          );
          fromDirect.push(
            getCursorSpelling(
              arg as unknown as Parameters<typeof getCursorSpelling>[0],
            ),
          );
        }

        assertEquals(
          fromVisit,
          fromDirect,
          `${name}: visitChildren vs direct API mismatch`,
        );
      }
    } finally {
      await cleanup();
    }
  },
});
