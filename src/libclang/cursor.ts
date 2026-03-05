/**
 * Cursor functions
 */

import {
  CXChildVisitResult,
  type CXCursor,
  type CXCursorKind,
  type SourceLocation,
  type SourceRange,
} from "../ffi/types.ts";
import {
  addCollectedCursorBuffer,
  clearCollectedCursors,
  getCollectedCursorBuffers,
  getVisitor,
  popVisitContext,
  pushVisitContext,
  shouldCollect,
} from "../ffi/state.ts";
import { getSymbols } from "./library.ts";
import {
  cxStringToString,
  parseSourceLocation,
  parseSourceRange,
  toNativeCursor,
} from "./helpers.ts";
import { NativeCXCursor } from "./native_cursor.ts";
import { bigintToPtrValue, POINTER_SIZE, readPtr } from "../utils/ffi.ts";

/**
 * Get the kind of a cursor
 *
 * @param cursor - The cursor to get the kind from
 * @returns The CXCursorKind value identifying the type of AST node
 */
export function getCursorKind(cursor: CXCursor): CXCursorKind {
  const sym = getSymbols();
  return sym.clang_getCursorKind(cursor) as CXCursorKind;
}

/**
 * Get the spelling (name) of a cursor
 *
 * @param cursor - The cursor to get the spelling from
 * @returns The spelling string of the cursor (e.g., function name, type name)
 */
export function getCursorSpelling(cursor: CXCursor): string {
  const sym = getSymbols();
  const cxString = sym.clang_getCursorSpelling(cursor);
  return cxStringToString(cxString);
}

/**
 * Get the spelling of a cursor from its buffer
 *
 * This function works with the raw cursor buffers returned by visitChildren,
 * avoiding the need to construct a CXCursor object.
 *
 * @param buffer - The Uint8Array buffer containing the raw cursor data
 * @returns The spelling string of the cursor
 */
export function getCursorSpellingFromBuffer(buffer: Uint8Array): string {
  const sym = getSymbols();
  const cxString = sym.clang_getCursorSpelling(
    buffer as unknown as CXCursor,
  );
  return cxStringToString(cxString);
}

/**
 * Get the display name of a cursor
 *
 * The display name includes additional context like parameter types for functions.
 *
 * @param cursor - The cursor to get the display name from
 * @returns The display name string (e.g., "void foo(int, int)" for a function)
 */
export function getCursorDisplayName(cursor: CXCursor): string {
  const sym = getSymbols();
  const cxString = sym.clang_getCursorDisplayName(cursor);
  return cxStringToString(cxString);
}

/**
 * Get the location of a cursor in the source code
 *
 * @param cursor - The cursor to get the location from (CXCursor or Uint8Array buffer)
 * @returns SourceLocation containing file, line, column, and offset
 */
export function getCursorLocation(
  cursor: CXCursor | Uint8Array,
): SourceLocation {
  const sym = getSymbols();
  const location = sym.clang_getCursorLocation(toNativeCursor(cursor));
  return parseSourceLocation(location);
}

/**
 * Get the extent (source range) of a cursor
 *
 * @param cursor - The cursor to get the extent from (CXCursor or Uint8Array buffer)
 * @returns SourceRange containing start and end locations
 */
export function getCursorExtent(cursor: CXCursor | Uint8Array): SourceRange {
  const sym = getSymbols();
  const range = sym.clang_getCursorExtent(toNativeCursor(cursor));
  return parseSourceRange(range);
}

/**
 * Options for visitChildren
 */
export interface VisitChildrenOptions {
  /** If true, collect and return cursor buffers. Default: true for backward compatibility */
  collect?: boolean;
}

/**
 * Visit all children of a cursor
 *
 * @param cursor - The parent cursor (CXCursor or Uint8Array buffer from visitChildren)
 * @param visitor - Callback function called for each child cursor
 * @param options - Optional options to control buffer collection
 * @returns Array of child cursor buffers (Uint8Array) that can be passed to FFI functions
 */
export function visitChildren(
  cursor: CXCursor | Uint8Array,
  visitor: (cursor: CXCursor, parent: CXCursor) => CXChildVisitResult,
  options?: VisitChildrenOptions,
): Uint8Array[] {
  const sym = getSymbols();
  const shouldCollectValue = options?.collect ?? true;

  // Push a new visit context onto the stack for re-entrant safety
  pushVisitContext({
    visitor,
    collect: shouldCollectValue,
    buffers: [],
  });

  // Create the native callback
  const visitorPtr = createVisitorCallback();

  let buffers: Uint8Array[] = [];

  try {
    sym.clang_visitChildren(
      toNativeCursor(cursor),
      visitorPtr,
      null as unknown as Deno.PointerValue,
    );
  } finally {
    // Clean up the callback to prevent memory leak (uses shared closeCurrentCallback)
    closeCurrentCallback();

    // Get collected cursor buffers and clean up (if collect is true)
    if (shouldCollectValue) {
      buffers = getCollectedCursorBuffers();
    }
    clearCollectedCursors();

    // Pop the visit context
    popVisitContext();
  }

  // Return the raw buffers - these can be passed to FFI functions like getCursorType
  return buffers;
}

/**
 * Keeps the callback alive during native visitation.
 * Without this, the UnsafeCallback could be garbage collected
 * while clang_visitChildren is still executing.
 */
let currentCallback: Deno.UnsafeCallback | null = null;

/**
 * Close the current callback if it exists
 */
function closeCurrentCallback(): void {
  if (
    currentCallback && typeof currentCallback === "object" &&
    "close" in currentCallback
  ) {
    (currentCallback as { close: () => void }).close();
    currentCallback = null;
  }
}

function createVisitorCallback(): Deno.PointerValue {
  // Close any existing callback before creating a new one
  closeCurrentCallback();

  const callback = new Deno.UnsafeCallback(
    {
      parameters: [
        { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
        { struct: ["u32", "i32", "pointer", "pointer", "pointer"] },
        "pointer",
      ],
      result: "i32",
    },
    (
      cursorStruct: Uint8Array,
      parentStruct: Uint8Array,
      _clientData: Deno.PointerValue,
    ): number => {
      // Parse CXCursor from the cursor struct buffer
      const cursorView = new DataView(
        cursorStruct.buffer,
        cursorStruct.byteOffset,
        cursorStruct.byteLength,
      );
      const cursorKind = cursorView.getUint32(0, true);
      const cursorXdata = cursorView.getInt32(4, true);
      const cursorData0 = readPtr(cursorView, 8);
      const cursorData1 = readPtr(cursorView, 8 + POINTER_SIZE);
      const cursorData2 = readPtr(cursorView, 8 + POINTER_SIZE * 2);

      // Create a native buffer that can be passed to FFI functions
      const nativeCursor = new NativeCXCursor(
        cursorKind,
        cursorXdata,
        cursorData0,
        cursorData1,
        cursorData2,
      );

      // Get the CXCursor object for the visitor callback
      const cursor = nativeCursor.toCXCursor();

      // Parse parent cursor from the parent struct buffer
      const parentView = new DataView(
        parentStruct.buffer,
        parentStruct.byteOffset,
        parentStruct.byteLength,
      );
      const parentKind = parentView.getUint32(0, true);
      const parentXdata = parentView.getInt32(4, true);
      const parentData0 = readPtr(parentView, 8);
      const parentData1 = readPtr(parentView, 8 + POINTER_SIZE);
      const parentData2 = readPtr(parentView, 8 + POINTER_SIZE * 2);

      const parent: CXCursor = {
        kind: parentKind as CXCursorKind,
        xdata: parentXdata,
        data: [
          bigintToPtrValue(parentData0),
          bigintToPtrValue(parentData1),
          bigintToPtrValue(parentData2),
        ],
      };

      // Call the JS visitor function from global state
      const visitor = getVisitor();
      if (visitor) {
        const result = visitor(cursor, parent);

        // Only collect the native buffer if collection is enabled
        if (shouldCollect()) {
          const cursorBuffer = nativeCursor.getBuffer();
          addCollectedCursorBuffer(cursorBuffer);
        }

        // Return the visitor result directly - CXChildVisitResult values
        // (Break=0, Continue=1, Recurse=2) are passed through to native code.
        return result;
      }

      // If no visitor, return Continue to continue traversal
      return CXChildVisitResult.Continue;
    },
  );

  // Store callback globally for cleanup
  currentCallback = callback as Deno.UnsafeCallback;

  // Return just the pointer
  return callback.pointer;
}

/**
 * Get the spelling (name) of a cursor kind
 *
 * @param kind - The CXCursorKind to get the spelling for
 * @returns The string name of the cursor kind (e.g., "StructDecl", "FunctionDecl")
 */
export function getCursorKindSpelling(kind: CXCursorKind): string {
  const sym = getSymbols();
  const cxString = sym.clang_getCursorKindSpelling(kind as number);
  return cxStringToString(cxString);
}

/**
 * Get the availability of a cursor
 *
 * @param cursor - The cursor to check availability for (CXCursor or Uint8Array buffer)
 * @returns CXAvailabilityKind value (0=Available, 1=Deprecated, 2=NotAvailable, 3=NotAccessible)
 */
export function getCursorAvailability(cursor: CXCursor | Uint8Array): number {
  const sym = getSymbols();
  return sym.clang_getCursorAvailability(toNativeCursor(cursor));
}

/**
 * Get the cursor that a cursor refers to
 *
 * For example, for a reference to a variable, returns the declaration of that variable.
 *
 * @param cursor - The cursor to get the referenced cursor from (CXCursor or Uint8Array buffer)
 * @returns The referenced CXCursor, or a null cursor if not available
 */
export function getCursorReferenced(cursor: CXCursor | Uint8Array): CXCursor {
  const sym = getSymbols();
  return sym.clang_getCursorReferenced(toNativeCursor(cursor));
}

/**
 * Get the definition of a cursor
 *
 * Returns the definition of the entity that this cursor refers to.
 *
 * @param cursor - The cursor to get the definition from (CXCursor or Uint8Array buffer)
 * @returns The defining CXCursor, or a null cursor if no definition is available
 */
export function getCursorDefinition(cursor: CXCursor | Uint8Array): CXCursor {
  const sym = getSymbols();
  return sym.clang_getCursorDefinition(toNativeCursor(cursor));
}

/**
 * Get the signed integer value of an enum constant declaration
 *
 * @param cursor - CXCursor for an EnumConstantDecl, or Uint8Array buffer
 * @returns The enum constant value as a bigint
 */
export function getEnumConstantDeclValue(
  cursor: CXCursor | Uint8Array,
): bigint {
  const sym = getSymbols();
  return sym.clang_getEnumConstantDeclValue(toNativeCursor(cursor));
}

/**
 * Get the unsigned integer value of an enum constant declaration
 *
 * @param cursor - CXCursor for an EnumConstantDecl, or Uint8Array buffer
 * @returns The enum constant value as a bigint
 */
export function getEnumConstantDeclUnsignedValue(
  cursor: CXCursor | Uint8Array,
): bigint {
  const sym = getSymbols();
  return sym.clang_getEnumConstantDeclUnsignedValue(toNativeCursor(cursor));
}

/**
 * Get the Unified Symbol Resolution (USR) for a cursor
 *
 * USRs are unique identifiers for symbols that can be used to deduplicate
 * types across the AST. For structs, unions, functions, etc., the USR
 * provides a stable identifier.
 *
 * @param cursor - CXCursor or Uint8Array buffer
 * @returns The USR string for the cursor
 */
export function getCursorUSR(cursor: CXCursor | Uint8Array): string {
  const sym = getSymbols();
  const cxString = sym.clang_getCursorUSR(toNativeCursor(cursor));
  return cxStringToString(cxString);
}
