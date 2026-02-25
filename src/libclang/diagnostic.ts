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
 *
 * @param unit - The translation unit to get diagnostics from
 * @returns The number of diagnostics
 */
export function getNumDiagnostics(unit: CXTranslationUnit): number {
  const sym = getSymbols();
  return sym.clang_getNumDiagnostics(unit);
}

/**
 * Get a diagnostic from a translation unit by index
 *
 * @param unit - The translation unit to get the diagnostic from
 * @param index - The index of the diagnostic (0-based)
 * @returns The CXDiagnostic at the specified index
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
 *
 * @param diagnostic - The diagnostic to dispose
 */
export function disposeDiagnostic(diagnostic: CXDiagnostic): void {
  const sym = getSymbols();
  sym.clang_disposeDiagnostic(diagnostic);
}

/**
 * Get the severity of a diagnostic
 *
 * @param diagnostic - The diagnostic to get the severity from
 * @returns The CXDiagnosticSeverity value (0=Ignored, 1=Note, 2=Warning, 3=Error, 4=Fatal)
 */
export function getDiagnosticSeverity(
  diagnostic: CXDiagnostic,
): CXDiagnosticSeverity {
  const sym = getSymbols();
  return sym.clang_getDiagnosticSeverity(diagnostic) as CXDiagnosticSeverity;
}

/**
 * Get the spelling (message) of a diagnostic
 *
 * @param diagnostic - The diagnostic to get the message from
 * @returns The diagnostic message string
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
 *
 * @param unit - The translation unit to get diagnostics from
 * @returns Array of Diagnostic objects containing severity, message, and location
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
