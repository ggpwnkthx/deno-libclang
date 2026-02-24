/**
 * High-level libclang wrapper
 *
 * A user-friendly TypeScript API wrapping the FFI calls
 */

// Re-export from submodules for backward compatibility

// Library management
export { load, unload } from "./libclang/library.ts";

// Index functions
export { createIndex, disposeIndex } from "./libclang/index.ts";

// Translation Unit functions
export {
  disposeTranslationUnit,
  getTranslationUnitCursor,
  parseTranslationUnit,
  reparseTranslationUnit,
} from "./libclang/translation_unit.ts";

// Cursor functions
export {
  getCursorAvailability,
  getCursorDefinition,
  getCursorDisplayName,
  getCursorExtent,
  getCursorKind,
  getCursorKindSpelling,
  getCursorLocation,
  getCursorReferenced,
  getCursorSpelling,
  getCursorSpellingFromBuffer,
  getCursorUSR,
  getEnumConstantDeclUnsignedValue,
  getEnumConstantDeclValue,
  visitChildren,
} from "./libclang/cursor.ts";

// Type functions
export {
  getArgType,
  getCursorType,
  getNumArgTypes,
  getPointeeType,
  getResultType,
  getTypedefUnderlyingType,
  getTypeKind,
  getTypeKindSpelling,
  getTypeSpelling,
  getValueType,
} from "./libclang/type.ts";

// Diagnostic functions
export {
  disposeDiagnostic,
  getDiagnostic,
  getDiagnostics,
  getDiagnosticSeverity,
  getDiagnosticSpelling,
  getNumDiagnostics,
} from "./libclang/diagnostic.ts";

// File functions
export {
  fileIsNull,
  getFile,
  getFileName,
  getLocation,
} from "./libclang/file.ts";

// Native cursor wrapper
export { NativeCXCursor } from "./libclang/native_cursor.ts";

// Re-export types
export type {
  CursorVisitor,
  CXCursor,
  CXDiagnostic,
  CXFile,
  CXIndex,
  CXSourceLocation,
  CXSourceRange,
  CXString,
  CXTranslationUnit,
  CXType,
  CXUnsavedFile as UnsavedFile,
  Diagnostic,
  ParseResult,
  SourceLocation,
  SourceRange,
} from "./ffi/types.ts";

/**
 * Type for cursor that can be either:
 * - CXCursor: from translation unit (passed directly to FFI)
 * - Uint8Array: buffer from visitChildren (native CXCursor struct)
 */
export type CXCursorOrBuffer = import("./ffi/types.ts").CXCursor | Uint8Array;
