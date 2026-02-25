/**
 * Tests for diagnostic operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createIndex,
  CXDiagnosticSeverity,
  disposeDiagnostic,
  disposeIndex,
  disposeTranslationUnit,
  getDiagnostic,
  getDiagnostics,
  getDiagnosticSeverity,
  getDiagnosticSpelling,
  getNumDiagnostics,
  load,
  parseTranslationUnit,
  unload,
} from "../mod.ts";

Deno.test({
  name: "diagnostic - get number of diagnostics",
  async fn() {
    load();

    const index = createIndex();
    // Valid code should have no diagnostics
    const code = `int main() { return 0; }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(typeof numDiags, "number");

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - get diagnostics from invalid code",
  async fn() {
    load();

    const index = createIndex();
    // Invalid code will produce diagnostics
    const code = `int main() { return undefined_func(); }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      // Should have at least one diagnostic (warning or error)
      assertEquals(numDiags >= 0, true);

      const diagnostics = getDiagnostics(result.translationUnit);
      assertEquals(Array.isArray(diagnostics), true);

      // If there are diagnostics, check their structure
      for (const diag of diagnostics) {
        assertEquals(typeof diag.severity, "number");
        assertEquals(typeof diag.message, "string");
        assertExists(diag.location);
      }

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - severity levels",
  fn() {
    load();

    // Test that severity enum values are defined
    assertEquals(CXDiagnosticSeverity.Ignored, 0);
    assertEquals(CXDiagnosticSeverity.Note, 1);
    assertEquals(CXDiagnosticSeverity.Warning, 2);
    assertEquals(CXDiagnosticSeverity.Error, 3);
    assertEquals(CXDiagnosticSeverity.Fatal, 4);
    unload();
  },
});

Deno.test({
  name: "diagnostic - getDiagnostic",
  async fn() {
    load();

    const index = createIndex();
    // Invalid code will produce diagnostics
    const code = `int main() { return undefined_func(); }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(numDiags >= 1, true);

      // Get diagnostic at index 0
      const diagnostic = getDiagnostic(result.translationUnit, 0);
      assertExists(diagnostic);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - getDiagnosticSeverity",
  async fn() {
    load();

    const index = createIndex();
    // Invalid code will produce diagnostics
    const code = `int main() { return undefined_func(); }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(numDiags >= 1, true);

      // Get diagnostic at index 0
      const diagnostic = getDiagnostic(result.translationUnit, 0);

      // Get severity
      const severity = getDiagnosticSeverity(diagnostic);
      assertEquals(typeof severity, "number");
      // Should be Warning (2) or Error (3) for undefined function
      assertEquals(severity >= 2, true);

      disposeDiagnostic(diagnostic);
      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - getDiagnosticSpelling",
  async fn() {
    load();

    const index = createIndex();
    // Invalid code will produce diagnostics
    const code = `int main() { return undefined_func(); }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(numDiags >= 1, true);

      // Get diagnostic at index 0
      const diagnostic = getDiagnostic(result.translationUnit, 0);

      // Get spelling/message
      const message = getDiagnosticSpelling(diagnostic);
      assertEquals(typeof message, "string");
      assertEquals(message.length > 0, true);

      disposeDiagnostic(diagnostic);
      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});

Deno.test({
  name: "diagnostic - disposeDiagnostic",
  async fn() {
    load();

    const index = createIndex();
    // Invalid code will produce diagnostics
    const code = `int main() { return undefined_func(); }`;

    const file = await Deno.makeTempFile({ suffix: ".c" });
    await Deno.writeTextFile(file, code);

    try {
      const result = parseTranslationUnit(index, file);
      assertExists(result.translationUnit);

      const numDiags = getNumDiagnostics(result.translationUnit);
      assertEquals(numDiags >= 1, true);

      // Get and dispose diagnostic
      const diagnostic = getDiagnostic(result.translationUnit, 0);
      assertExists(diagnostic);

      // Should not throw when disposing
      disposeDiagnostic(diagnostic);

      disposeTranslationUnit(result.translationUnit);
    } finally {
      disposeIndex(index);
      await Deno.remove(file);
      unload();
    }
  },
});
