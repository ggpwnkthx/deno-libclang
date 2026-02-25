/**
 * libclang FFI symbol definitions
 *
 * Defines FFI symbols (function pointers) for all libclang functions
 */

import type { LibclangSymbols } from "./types.ts";

/**
 * Creates the FFI symbol definitions for libclang
 */
export function getLibclangSymbols(): LibclangSymbols {
  return {
    // Index functions
    clang_createIndex: {
      parameters: ["i32", "i32"],
      result: "pointer",
    } as unknown as LibclangSymbols["clang_createIndex"],
    clang_disposeIndex: {
      parameters: ["pointer"],
      result: "void",
    } as unknown as LibclangSymbols["clang_disposeIndex"],

    // Translation unit functions
    clang_parseTranslationUnit: {
      parameters: [
        "pointer",
        "pointer",
        "pointer",
        "i32",
        "pointer",
        "i32",
        "u32",
      ],
      result: "pointer",
    } as unknown as LibclangSymbols["clang_parseTranslationUnit"],
    clang_disposeTranslationUnit: {
      parameters: ["pointer"],
      result: "void",
    } as unknown as LibclangSymbols["clang_disposeTranslationUnit"],
    clang_reparseTranslationUnit: {
      parameters: ["pointer", "i32", "pointer", "u32"],
      result: "i32",
    } as unknown as LibclangSymbols["clang_reparseTranslationUnit"],

    // Cursor functions
    clang_getTranslationUnitCursor: {
      parameters: ["pointer"],
      result: { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getTranslationUnitCursor"],
    clang_getCursorKind: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "u32",
    } as unknown as LibclangSymbols["clang_getCursorKind"],
    clang_getCursorSpelling: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getCursorSpelling"],
    clang_getCursorKindSpelling: {
      parameters: ["u32"],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getCursorKindSpelling"],
    clang_getCursorLocation: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["pointer", "pointer", "u32"] },
    } as unknown as LibclangSymbols["clang_getCursorLocation"],
    clang_getCursorExtent: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["pointer", "pointer", "u32", "u32"] },
    } as unknown as LibclangSymbols["clang_getCursorExtent"],
    clang_visitChildren: {
      parameters: [
        { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
        "pointer",
        "pointer",
      ],
      result: "u32",
    } as unknown as LibclangSymbols["clang_visitChildren"],

    // Type functions
    clang_getCursorType: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      // LLVM 20 changed CXType - try with 3 fields + 2 pointers
      result: {
        struct: ["u32", "u32", "pointer", "pointer"],
      },
    } as unknown as LibclangSymbols["clang_getCursorType"],
    // clang_getTypeKind was removed in LLVM 20 - kind is now directly in CXType struct
    clang_getTypeSpelling: {
      parameters: [{
        // LLVM 20 changed CXType - try with 3 fields + 2 pointers
        struct: ["u32", "u32", "pointer", "pointer"],
      }],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getTypeSpelling"],

    // Function argument types
    clang_getNumArgTypes: {
      parameters: [{
        // CXType struct
        struct: ["u32", "u32", "pointer", "pointer"],
      }],
      result: "i32",
    } as unknown as LibclangSymbols["clang_getNumArgTypes"],
    clang_getArgType: {
      parameters: [{
        // CXType struct
        struct: ["u32", "u32", "pointer", "pointer"],
      }, "i32"],
      result: { struct: ["u32", "u32", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getArgType"],

    // Diagnostic functions
    clang_getNumDiagnostics: {
      parameters: ["pointer"],
      result: "u32",
    } as unknown as LibclangSymbols["clang_getNumDiagnostics"],
    clang_getDiagnostic: {
      parameters: ["pointer", "u32"],
      result: "pointer",
    } as unknown as LibclangSymbols["clang_getDiagnostic"],
    clang_disposeDiagnostic: {
      parameters: ["pointer"],
      result: "void",
    } as unknown as LibclangSymbols["clang_disposeDiagnostic"],
    clang_getDiagnosticSeverity: {
      parameters: ["pointer"],
      result: "i32",
    } as unknown as LibclangSymbols["clang_getDiagnosticSeverity"],
    clang_getDiagnosticSpelling: {
      parameters: ["pointer"],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getDiagnosticSpelling"],

    // String functions
    clang_getCString: {
      parameters: [{ struct: ["pointer", "u64"] }],
      result: "pointer",
    } as unknown as LibclangSymbols["clang_getCString"],
    clang_disposeString: {
      parameters: [{ struct: ["pointer", "u64"] }],
      result: "void",
    } as unknown as LibclangSymbols["clang_disposeString"],

    // File and location functions
    clang_getFile: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    } as unknown as LibclangSymbols["clang_getFile"],
    clang_getLocation: {
      parameters: ["pointer", "pointer", "u32", "u32"],
      result: { struct: ["pointer", "pointer", "u32"] },
    } as unknown as LibclangSymbols["clang_getLocation"],
    clang_getRangeStart: {
      parameters: [{ struct: ["pointer", "pointer", "u32", "u32"] }],
      result: { struct: ["pointer", "pointer", "u32"] },
    } as unknown as LibclangSymbols["clang_getRangeStart"],
    clang_getRangeEnd: {
      parameters: [{ struct: ["pointer", "pointer", "u32", "u32"] }],
      result: { struct: ["pointer", "pointer", "u32"] },
    } as unknown as LibclangSymbols["clang_getRangeEnd"],
    clang_getFileName: {
      parameters: ["pointer"],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getFileName"],
    // clang_file_isNull was removed in LLVM 20

    // Spelling/display names
    clang_getCursorDisplayName: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getCursorDisplayName"],
    clang_getTypeKindSpelling: {
      parameters: ["u32"],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getTypeKindSpelling"],

    // Availability
    clang_getCursorAvailability: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "i32",
    } as unknown as LibclangSymbols["clang_getCursorAvailability"],

    // Source range functions
    clang_getCursorReferenced: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getCursorReferenced"],
    clang_getCursorDefinition: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getCursorDefinition"],

    // Typedef resolution
    clang_getTypedefDeclUnderlyingType: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getTypedefDeclUnderlyingType"],

    // Type decomposition
    clang_Type_getValueType: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_Type_getValueType"],

    // Function result type
    clang_getResultType: {
      parameters: [{ struct: ["u32", "u32", "pointer", "pointer"] }],
      result: { struct: ["u32", "u32", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getResultType"],

    // Get pointee type
    clang_getPointeeType: {
      parameters: [{ struct: ["u32", "u32", "pointer", "pointer"] }],
      result: { struct: ["u32", "u32", "pointer", "pointer"] },
    } as unknown as LibclangSymbols["clang_getPointeeType"],

    // Enum constant value functions
    clang_getEnumConstantDeclValue: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "i64",
    } as unknown as LibclangSymbols["clang_getEnumConstantDeclValue"],
    clang_getEnumConstantDeclUnsignedValue: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "u64",
    } as unknown as LibclangSymbols["clang_getEnumConstantDeclUnsignedValue"],

    // USR functions
    clang_getCursorUSR: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: { struct: ["pointer", "u64"] },
    } as unknown as LibclangSymbols["clang_getCursorUSR"],

    // Source location functions
    clang_getInstantiationLocation: {
      parameters: [{ struct: ["pointer", "pointer", "u32"] }],
      result: { struct: ["pointer", "pointer", "u32"] },
    } as unknown as LibclangSymbols["clang_getInstantiationLocation"],
    clang_getDiagnosticLocation: {
      parameters: ["pointer"],
      result: { struct: ["pointer", "pointer", "u32"] },
    } as unknown as LibclangSymbols["clang_getDiagnosticLocation"],

    // Type size and alignment
    clang_Type_getSizeOf: {
      parameters: [{
        // CXType struct
        struct: ["u32", "u32", "pointer", "pointer"],
      }],
      result: "i64",
    } as unknown as LibclangSymbols["clang_Type_getSizeOf"],
    clang_Type_getAlignOf: {
      parameters: [{
        // CXType struct
        struct: ["u32", "u32", "pointer", "pointer"],
      }],
      result: "i64",
    } as unknown as LibclangSymbols["clang_Type_getAlignOf"],

    // Cursor attributes
    clang_Cursor_isStaticFunction: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "i32",
    } as unknown as LibclangSymbols["clang_Cursor_isStaticFunction"],
    clang_Cursor_isInline: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "i32",
    } as unknown as LibclangSymbols["clang_Cursor_isInline"],
    clang_Cursor_isVariadic: {
      parameters: [{ struct: ["u32", "i32", "pointer", "pointer", "pointer"] }],
      result: "i32",
    } as unknown as LibclangSymbols["clang_Cursor_isVariadic"],
  };
}
