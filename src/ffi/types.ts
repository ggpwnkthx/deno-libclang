/**
 * libclang FFI type definitions
 *
 * Type definitions matching libclang's C types
 */

// Use Deno's native pointer type

/** Native pointer type representing a memory address */
export type NativePointer = Deno.PointerValue;

// ============================================================================
// Core Types
// ============================================================================

/** Opaque index type */
export type CXIndex = NativePointer;

/** Opaque translation unit type */
export type CXTranslationUnit = NativePointer;

/** Cursor represents a location in the AST */
export type CXCursor = {
  /** The cursor kind */
  kind: number;
  /** An integer identifying the specific AST node */
  xdata: number;
  /** Three 'void*' entries */
  data: [NativePointer, NativePointer, NativePointer];
};

/** Represents a type in the Clang AST */
// LLVM 20 changed CXType - try with 3 fields
export type CXType = {
  /** The type kind (CXTypeKind) */
  kind: number;
  /** Reserved */
  reserved: number;
  /** Type data (pointer-sized) */
  data0: NativePointer;
  /** Type data (pointer-sized) */
  data1: NativePointer;
};

/** Represents a file */
export type CXFile = NativePointer;

/** Represents a source location */
export type CXSourceLocation = {
  /** The source location data */
  ptr_data: [NativePointer, NativePointer];
  /** The file ID */
  int_data: number;
};

/** Represents a source range */
export type CXSourceRange = {
  /** The start location */
  ptr_data: [NativePointer, NativePointer];
  /** The end location */
  int_data: [number, number];
};

/** Diagnostic severity levels */
export enum CXDiagnosticSeverity {
  /** A diagnostic that has been suppressed */
  Ignored = 0,
  /** A diagnostic that has been noted */
  Note = 1,
  /** A warning diagnostic */
  Warning = 2,
  /** An error diagnostic */
  Error = 3,
  /** A fatal error diagnostic */
  Fatal = 4,
}

/** A diagnostic (error, warning, note) */
export type CXDiagnostic = NativePointer;

/** Opaque string type for libclang strings */
export type CXString = {
  /** NativePointer to string data */
  data: NativePointer;
  /** String length */
  length: number;
};

/** Represents an unsaved (in-memory) file */
export interface CXUnsavedFile {
  /** The filename */
  filename: string;
  /** The file contents */
  contents: string;
  /** Length of the contents */
  length: number;
}

// ============================================================================
// Cursor Kinds (enum CXCursorKind)
// ============================================================================

/**
 * Cursor kinds representing different types of AST nodes
 */
export enum CXCursorKind {
  // LLVM 20 has shifted enum values
  UnexposedDecl = 1,
  StructDecl = 2,
  UnionDecl = 3,
  ClassDecl = 4,
  EnumDecl = 5,
  FieldDecl = 6,
  EnumConstantDecl = 7,
  FunctionDecl = 8,
  VarDecl = 9,
  ParmDecl = 10,
  ArgDecl = 10,
  // In LLVM 20, TypedefDecl = 20
  TypedefDecl = 20,
  ObjCInterfaceDecl = 12,
  ObjCCategoryDecl = 13,
  ObjCProtocolDecl = 14,
  ObjCPropertyDecl = 15,
  ObjCIvarDecl = 16,
  ObjCInstanceMethodDecl = 17,
  ObjCClassMethodDecl = 18,
  ObjCImplementationDecl = 19,
  ObjCCategoryImplDecl = 20,
  // C++ declarations
  NamespaceDecl = 22,
  NamespaceAliasDecl = 23,
  UsingDirectiveDecl = 24,
  UsingDeclaration = 25,
  CXXConstructor = 34,
  CXXDestructor = 35,
  CXXMethod = 36,
  CXXOperatorCallExpr = 47,
  CXXMemberCallExpr = 48,
  // Note: CXXCallExpr alias handled below
  CXXNewExpr = 53,
  CXXDeleteExpr = 54,
  CXXThisExpr = 55,
  CXXNullPtrLiteralExpr = 56,
  CXXBoolLiteralExpr = 57,
  CXXStdInitializerListExpr = 58,
  CXXCatchStmt = 65,
  CXXTryStmt = 66,
  CXXThrowExpr = 67,
  CXXTryOrCatchStmt = 66,
  CXXTypeRefExpr = 200,
  TemplateRef = 41,
  NamespaceAliasRef = 42,
  MemberRef = 48,
  // MemberRefExpr is at 126
  LabelRef = 43,
  OverloadedDeclRef = 45,
  VariableRef = 46,
  // Template declarations
  TemplateTemplateParameter = 39,
  TemplateDecl = 41,
  NonTypeTemplateParameter = 43,
  // Other declarations
  LinkageSpec = 37,
  ExportDecl = 38,
  FileScopeAssmt = 60,
  StaticAssertDecl = 61,
  Attr = 62,
  // Expressions
  ThisExpr = 55,
  ExpressionStmt = 60,
  FloatingLiteral = 61,
  ImagLiteral = 62,
  PredefinedExpr = 63,
  // Statements
  AsmStmt = 64,
  SehTryStmt = 66,
  SehExceptStmt = 67,
  SehFinallyStmt = 68,
  MsAsmStmt = 69,
  NullStmt = 70,
  DeclStmt = 110,
  DoStmt = 111,
  ForStmt = 113,
  GotoStmt = 117,
  IfStmt = 118,
  ReturnStmt = 121,
  SwitchStmt = 122,
  WhileStmt = 123,
  BreakStmt = 124,
  ContinueStmt = 125,
  DefaultStmt = 127,
  CaseStmt = 128,
  AttributedStmt = 131,
  // Operators
  BinaryOperator = 106,
  UnaryOperator = 107,
  ConditionalOperator = 108,
  CompoundAssignOperator = 112,
  // Expressions (continued)
  CallExpr = 114,
  IntegerLiteral = 115,
  StringLiteral = 116,
  ParenExpr = 119,
  DeclRefExpr = 120,
  MemberRefExpr = 126,
  ArraySubscriptExpr = 129,
  InitListExpr = 130,
  StmtExpr = 131,
  CastExpr = 132,
  BinaryConditionalOperator = 133,
  OffsetOfExpr = 134,
  UnaryExpr = 135,
  SizeOfExpr = 137,
  VAArgExpr = 138,
  // References
  TypeRef = 30,
  TypoExpr = 33,
  CXXBaseSpecifier = 40,
  TemplateTypeParameter = 44,
  CXXAccessSpecifier = 47,
  OverloadDecl = 63,
  // Misc
  CompoundStmt = 100,
  LabelStmt = 109,
  TypeRefExpr = 200,
  RefExpr = 202,
  OpaqueValueExpr = 210,
  BlockExpr = 215,
  NoDeclFound = 301,
  NotImplemented = 302,
  InvalidCode = 400,
  // Aliases for compatibility
  TranslationUnit = 350,
  SehLeaveStmt = 70,
}

// ============================================================================
// Type Kinds (enum CXTypeKind)
// ============================================================================

/**
 * Type kinds representing different types in the Clang type system
 */
export enum CXTypeKind {
  Invalid = 0,
  Unexposed = 1,
  Void = 2,
  Bool = 3,
  Char_U = 4,
  UChar = 5,
  Char16 = 6,
  Char32 = 7,
  UShort = 8,
  UInt = 9,
  ULong = 10,
  ULongLong = 11,
  UInt128 = 12,
  Char_S = 13,
  SChar = 14,
  WChar = 15,
  Short = 16,
  Int = 17,
  Long = 18,
  LongLong = 19,
  Int128 = 20,
  Float = 21,
  Double = 22,
  LongDouble = 23,
  NullPtr = 24,
  Overload = 25,
  Dependent = 26,
  ObjCId = 27,
  ObjCClass = 28,
  ObjCSel = 29,
  Float128 = 30,
  Half = 31,
  Float16 = 32,
  ShortAccum = 33,
  Accum = 34,
  LongAccum = 35,
  UShortAccum = 36,
  UAccum = 37,
  ULongAccum = 38,
  BFloat16 = 39,
  Ibm128 = 40,
  // 41-100: Unknown/reserved
  Enum = 106,
  Typedef = 107,
  Record = 105,
  Pointer = 101,
  BlockPointer = 102,
  LValueReference = 103,
  RValueReference = 104,
  Complex = 100,
  FunctionNoProto = 110,
  FunctionProto = 111,
  ConstantArray = 112,
  Vector = 113,
  IncompleteArray = 114,
  VariableArray = 115,
  DependentSizedArray = 116,
  MemberNativePointer = 117,
  Auto = 118,
  Attributed = 121,
  Opaque = 122,
  Elaborated = 149,
}

// ============================================================================
// Error Codes (enum CXErrorCode)
// ============================================================================

/**
 * Error codes returned by libclang functions
 */
export enum CXErrorCode {
  Success = 0,
  Failure = 1,
  Crashed = 2,
  InvalidArguments = 3,
  ASTReadError = 4,
}

// ============================================================================
// Availability Kinds (enum CXAvailabilityKind)
// ============================================================================

/**
 * Availability kinds indicating the availability of a declaration
 */
export enum CXAvailabilityKind {
  Available = 0,
  Deprecated = 1,
  NotAvailable = 2,
  NotAccessible = 3,
}

// ============================================================================
// Linkage Kinds (enum CXLinkage)
// ============================================================================

/**
 * Linkage kinds indicating the linkage of a declaration
 */
export enum CXLinkage {
  NoLinkage = 0,
  Internal = 1,
  UniqueExternal = 2,
  External = 3,
}

// ============================================================================
// Visibility Kinds (enum CXVisibility)
// ============================================================================

/**
 * Visibility kinds indicating the visibility of a declaration
 */
export enum CXVisibility {
  Invalid = 0,
  Hidden = 1,
  Protected = 2,
  Default = 3,
}

// ============================================================================
// Access Specifier Kinds (enum CXAccessSpecifier)
// ============================================================================

/**
 * Access specifier kinds indicating the access level of a declaration
 */
export enum CXAccessSpecifier {
  Invalid = 0,
  Public = 1,
  Protected = 2,
  Private = 3,
}

// ============================================================================
// Translation Unit Flags
// ============================================================================

/**
 * Flags controlling translation unit parsing
 */
export enum CXTranslationUnit_Flags {
  /** None */
  None = 0,
  /** Use detailed preprocessing record */
  DetailedPreprocessingRecord = 1,
  /** Skip function bodies */
  SkipFunctionBodies = 2,
  /** Include brief comments in the AST */
  IncludeBriefCommentsInCodeCompletion = 4,
  /** Store preprocessor stats */
  StorePreprocessingStats = 8,
  /** Do not comment function bodies */
  SkipFunctionBodiesExceptHeaders = 16,
  /** Include macro definitions in code completion */
  IncludeMacroDefinitionsInCodeCompletion = 32,
  /** Do inline macro definitions */
  CompleteInlineMacros = 64,
  /** Do not cache results */
  DoNotCacheCompletionResults = 128,
  /** Precompile preamble */
  PrecompilePreamble = 256,
  /** Cache completion results */
  CacheCompletionResults = 512,
  /** Use completion results with completion priority */
  UsePrecompiledPreamble = 1024,
  /** Do not consider includes from modules */
  IgnoreParsedIncludesInCache = 2048,
}

// ============================================================================
// Cursor Visitor Result
// ============================================================================

/**
 * Return values for cursor visitor callbacks
 */
export enum CXChildVisitResult {
  /** Continue traversing */
  Continue = 0,
  /** Terminate traversal */
  Break = 1,
  /** Continue traversing but ignore siblings */
  Recurse = 2,
}

// ============================================================================
// Source Location Helpers
// ============================================================================

/**
 * Represents a location in source code
 */
export interface SourceLocation {
  /** The file path, or null if not available */
  file: string | null;
  /** The line number (1-based) */
  line: number;
  /** The column number (1-based) */
  column: number;
  /** The character offset from the start of the file */
  offset: number;
}

/**
 * Represents a range in source code
 */
export interface SourceRange {
  /** The starting location */
  start: SourceLocation;
  /** The ending location */
  end: SourceLocation;
}

// ============================================================================
// Parse Result
// ============================================================================

/**
 * Result of parsing a translation unit
 */
export interface ParseResult {
  /** The parsed translation unit, or null if parsing failed */
  translationUnit: CXTranslationUnit | null;
  /** Error message if parsing failed */
  error?: string;
  /**
   * Buffers that must be kept alive to maintain valid pointers.
   * These buffers contain the native memory for command-line arguments
   * and unsaved file contents. Keep these in scope for the lifetime
   * of the translation unit.
   */
  _keepAlive?: Uint8Array[];
}

// ============================================================================
// Diagnostic
// ============================================================================

/**
 * Represents a diagnostic message (error, warning, or note)
 */
export interface Diagnostic {
  /** The severity level of the diagnostic */
  severity: CXDiagnosticSeverity;
  /** The diagnostic message */
  message: string;
  /** The source location of the diagnostic */
  location: SourceLocation;
}

// ============================================================================
// Cursor Visitor Type
// ============================================================================

/** Callback for visiting cursor children */
export type CursorVisitor = (
  cursor: CXCursor,
  parent: CXCursor,
) => CXChildVisitResult;

// ============================================================================
// Native Function Types (for FFI)
// ============================================================================

/**
 * Interface containing all libclang FFI function symbols
 *
 * These functions are dynamically loaded from the libclang shared library.
 */
export interface LibclangSymbols {
  // Index functions
  clang_createIndex: (
    excludeDeclarationsFromPCH: number,
    displayDiagnostics: number,
  ) => CXIndex;
  clang_disposeIndex: (index: CXIndex) => void;

  // Translation unit functions
  clang_parseTranslationUnit: (
    index: CXIndex,
    sourceFile: NativePointer,
    commandLineArgs: NativePointer,
    numArgs: number,
    unsavedFiles: NativePointer,
    numUnsavedFiles: number,
    flags: number,
  ) => CXTranslationUnit;
  clang_disposeTranslationUnit: (unit: CXTranslationUnit) => void;
  clang_reparseTranslationUnit: (
    unit: CXTranslationUnit,
    numUnsavedFiles: number,
    unsavedFiles: NativePointer,
    flags: number,
  ) => number;

  // Cursor functions
  clang_getTranslationUnitCursor: (unit: CXTranslationUnit) => CXCursor;
  clang_getCursorKind: (cursor: CXCursor) => number;
  clang_getCursorSpelling: (cursor: CXCursor) => CXString;
  clang_getCursorKindSpelling: (kind: number) => CXString;
  clang_getCursorLocation: (cursor: CXCursor) => CXSourceLocation;
  clang_getCursorExtent: (cursor: CXCursor) => CXSourceRange;
  clang_visitChildren: (
    cursor: CXCursor,
    visitor: NativePointer,
    clientData: NativePointer,
  ) => number;

  // Type functions
  clang_getCursorType: (cursor: CXCursor) => CXType;
  // clang_getTypeKind was removed in LLVM 20 - kind is now directly in CXType.kind
  clang_getTypeKind?: (type: CXType) => number;
  clang_getTypeSpelling: (type: CXType) => CXString;

  // Function argument types
  clang_getNumArgTypes: (type: CXType) => number;
  clang_getArgType: (type: CXType, argIndex: number) => CXType;

  // Diagnostic functions
  clang_getNumDiagnostics: (unit: CXTranslationUnit) => number;
  clang_getDiagnostic: (unit: CXTranslationUnit, index: number) => CXDiagnostic;
  clang_disposeDiagnostic: (diagnostic: CXDiagnostic) => void;
  clang_getDiagnosticSeverity: (diagnostic: CXDiagnostic) => number;
  clang_getDiagnosticSpelling: (diagnostic: CXDiagnostic) => CXString;

  // String functions
  clang_getCString: (string: CXString) => NativePointer;
  clang_disposeString: (string: CXString) => void;

  // File and location functions
  clang_getFile: (unit: CXTranslationUnit, fileName: NativePointer) => CXFile;
  clang_getLocation: (
    unit: CXTranslationUnit,
    file: CXFile,
    line: number,
    column: number,
  ) => CXSourceLocation;
  clang_getRangeStart: (range: CXSourceRange) => CXSourceLocation;
  clang_getRangeEnd: (range: CXSourceRange) => CXSourceLocation;
  clang_getFileName: (file: CXFile) => CXString;
  // clang_file_isNull was removed in LLVM 20 - check CXFile pointer directly
  clang_file_isNull?: (file: CXFile) => number;

  // Spelling/display names
  clang_getCursorDisplayName: (cursor: CXCursor) => CXString;
  clang_getTypeKindSpelling: (kind: number) => CXString;

  // Availability
  clang_getCursorAvailability: (cursor: CXCursor) => number;

  // Source range functions
  clang_getCursorReferenced: (cursor: CXCursor) => CXCursor;
  clang_getCursorDefinition: (cursor: CXCursor) => CXCursor;

  // Typedef resolution
  clang_getTypedefDeclUnderlyingType: (cursor: CXCursor) => CXType;

  // Type decomposition - get value type from elaborated types
  clang_Type_getValueType: (type: CXType) => CXType;

  // Function result type
  clang_getResultType: (type: CXType) => CXType;

  // Get pointee type from pointer type
  clang_getPointeeType: (type: CXType) => CXType;

  // Enum constant value functions
  clang_getEnumConstantDeclValue: (cursor: CXCursor) => bigint;
  clang_getEnumConstantDeclUnsignedValue: (cursor: CXCursor) => bigint;

  // USR (Unique Symbol Reference) functions
  clang_getCursorUSR: (cursor: CXCursor) => CXString;

  // Source location functions
  clang_getInstantiationLocation: (
    location: CXSourceLocation,
  ) => CXSourceLocation;
  clang_getDiagnosticLocation: (
    diagnostic: CXDiagnostic,
  ) => CXSourceLocation;

  // Type size and alignment
  clang_Type_getSizeOf: (type: CXType) => number;
  clang_Type_getAlignOf: (type: CXType) => number;

  // Cursor attributes
  clang_Cursor_isStaticFunction: (cursor: CXCursor) => number;
  clang_Cursor_isInline: (cursor: CXCursor) => number;
  clang_Cursor_isVariadic: (cursor: CXCursor) => number;
}
