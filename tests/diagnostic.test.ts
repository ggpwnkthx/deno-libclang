/**
 * Tests for diagnostic operations
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  CXDiagnosticSeverity,
  disposeDiagnostic,
  getDiagnostic,
  getDiagnostics,
  getDiagnosticSeverity,
  getDiagnosticSpelling,
  getNumDiagnostics,
  load,
  unload,
} from "../mod.ts";
import { parseC } from "./test_utils.ts";

Deno.test({
  name: "diagnostic - get number of diagnostics",
  async fn() {
    // Valid code should have no diagnostics
    const { tu, cleanup } = await parseC(`int main() { return 0; }`);

    try {
      const numDiags = getNumDiagnostics(tu);
      assertEquals(typeof numDiags, "number");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "diagnostic - get diagnostics from invalid code",
  async fn() {
    // Invalid code will produce diagnostics
    const { tu, file, cleanup } = await parseC(
      `int main() { return undefined_func(); }`,
    );

    try {
      const numDiags = getNumDiagnostics(tu);
      // Should have at least one diagnostic (warning or error)
      assertEquals(
        numDiags >= 1,
        true,
        "Expected at least 1 diagnostic for invalid code",
      );

      const diagnostics = getDiagnostics(tu);
      assertEquals(Array.isArray(diagnostics), true);
      assertEquals(diagnostics.length >= 1, true);

      // Check diagnostic structure and location
      for (const diag of diagnostics) {
        assertEquals(typeof diag.severity, "number");
        assertEquals(typeof diag.message, "string");
        assertExists(diag.location);

        // Verify location has meaningful data
        assertExists(diag.location.file);
        assertEquals(diag.location.line >= 1, true, "Line should be >= 1");
        assertEquals(diag.location.column >= 1, true, "Column should be >= 1");

        // Location file should contain our temp file path or end with the filename
        assertEquals(
          diag.location.file === file || diag.location.file.endsWith(".c"),
          true,
          "Diagnostic should reference a .c file",
        );
      }
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "diagnostic - severity levels are defined",
  fn() {
    load();

    // Test that severity enum values are defined (but don't test exact values
    // as they can vary between LLVM versions)
    assertEquals(typeof CXDiagnosticSeverity.Ignored, "number");
    assertEquals(typeof CXDiagnosticSeverity.Note, "number");
    assertEquals(typeof CXDiagnosticSeverity.Warning, "number");
    assertEquals(typeof CXDiagnosticSeverity.Error, "number");
    assertEquals(typeof CXDiagnosticSeverity.Fatal, "number");

    // Verify ordering (Ignored < Note < Warning < Error < Fatal)
    assertEquals(
      CXDiagnosticSeverity.Ignored < CXDiagnosticSeverity.Note,
      true,
    );
    assertEquals(
      CXDiagnosticSeverity.Note < CXDiagnosticSeverity.Warning,
      true,
    );
    assertEquals(
      CXDiagnosticSeverity.Warning < CXDiagnosticSeverity.Error,
      true,
    );
    assertEquals(CXDiagnosticSeverity.Error < CXDiagnosticSeverity.Fatal, true);

    unload();
  },
});

Deno.test({
  name: "diagnostic - getDiagnostic",
  async fn() {
    // Invalid code will produce diagnostics
    const { tu, cleanup } = await parseC(
      `int main() { return undefined_func(); }`,
    );

    try {
      const numDiags = getNumDiagnostics(tu);
      assertEquals(numDiags >= 1, true);

      // Get diagnostic at index 0
      const diagnostic = getDiagnostic(tu, 0);
      assertExists(diagnostic);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "diagnostic - getDiagnosticSeverity",
  async fn() {
    // Invalid code will produce diagnostics
    const { tu, cleanup } = await parseC(
      `int main() { return undefined_func(); }`,
    );

    try {
      const numDiags = getNumDiagnostics(tu);
      assertEquals(numDiags >= 1, true);

      // Get diagnostic at index 0
      const diagnostic = getDiagnostic(tu, 0);

      // Get severity
      const severity = getDiagnosticSeverity(diagnostic);
      assertEquals(typeof severity, "number");
      // Should be Warning (2) or Error (3) for undefined function
      assertEquals(severity >= 2, true);

      disposeDiagnostic(diagnostic);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "diagnostic - getDiagnosticSpelling",
  async fn() {
    // Invalid code will produce diagnostics
    const { tu, cleanup } = await parseC(
      `int main() { return undefined_func(); }`,
    );

    try {
      const numDiags = getNumDiagnostics(tu);
      assertEquals(numDiags >= 1, true);

      // Get diagnostic at index 0
      const diagnostic = getDiagnostic(tu, 0);

      // Get spelling/message
      const message = getDiagnosticSpelling(diagnostic);
      assertEquals(typeof message, "string");
      assertEquals(message.length > 0, true);

      disposeDiagnostic(diagnostic);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "diagnostic - disposeDiagnostic",
  async fn() {
    // Invalid code will produce diagnostics
    const { tu, cleanup } = await parseC(
      `int main() { return undefined_func(); }`,
    );

    try {
      const numDiags = getNumDiagnostics(tu);
      assertEquals(numDiags >= 1, true);

      // Get and dispose diagnostic
      const diagnostic = getDiagnostic(tu, 0);
      assertExists(diagnostic);

      // Should not throw when disposing
      disposeDiagnostic(diagnostic);
    } finally {
      await cleanup();
    }
  },
});
