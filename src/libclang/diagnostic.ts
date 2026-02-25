/**
 * Diagnostic functions
 */

import type {
  CXDiagnostic,
  CXDiagnosticSeverity,
  CXTranslationUnit,
  Diagnostic,
  SourceLocation,
} from "../ffi/types.ts";
import { getSymbols } from "./library.ts";

/**
 * Get the number of diagnostics in a translation unit
 */
export function getNumDiagnostics(unit: CXTranslationUnit): number {
  const sym = getSymbols();
  return sym.clang_getNumDiagnostics(unit);
}

/**
 * Get a diagnostic from a translation unit
 */
export function getDiagnostic(
  unit: CXTranslationUnit,
  index: number,
): CXDiagnostic {
  const sym = getSymbols();
  return sym.clang_getDiagnostic(unit, index);
}

/**
 * Dispose of a diagnostic
 */
export function disposeDiagnostic(diagnostic: CXDiagnostic): void {
  const sym = getSymbols();
  sym.clang_disposeDiagnostic(diagnostic);
}

/**
 * Get the severity of a diagnostic
 */
export function getDiagnosticSeverity(
  diagnostic: CXDiagnostic,
): CXDiagnosticSeverity {
  const sym = getSymbols();
  return sym.clang_getDiagnosticSeverity(diagnostic) as CXDiagnosticSeverity;
}

/**
 * Get the spelling (message) of a diagnostic
 */
export function getDiagnosticSpelling(diagnostic: CXDiagnostic): string {
  const sym = getSymbols();
  const cxString = sym.clang_getDiagnosticSpelling(diagnostic);
  const cStr = sym.clang_getCString(cxString);
  const result = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  sym.clang_disposeString(cxString);
  return result;
}

/**
 * Get all diagnostics from a translation unit
 */
export function getDiagnostics(unit: CXTranslationUnit): Diagnostic[] {
  const numDiagnostics = getNumDiagnostics(unit);
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < numDiagnostics; i++) {
    const diagnostic = getDiagnostic(unit, i);
    const severity = getDiagnosticSeverity(diagnostic);
    const message = getDiagnosticSpelling(diagnostic);

    // For now, location is empty - could be enhanced
    const location: SourceLocation = {
      file: null,
      line: 0,
      column: 0,
      offset: 0,
    };

    diagnostics.push({
      severity,
      message,
      location,
    });

    disposeDiagnostic(diagnostic);
  }

  return diagnostics;
}
