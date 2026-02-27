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
  setVisitor,
} from "../ffi/state.ts";
import { getSymbols } from "./library.ts";
import {
  cxStringToString,
  parseSourceLocation,
  parseSourceRange,
  toNativeCursor,
} from "./helpers.ts";
import { NativeCXCursor } from "./native_cursor.ts";

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
 * Visit all children of a cursor
 *
 * @param cursor - The parent cursor (CXCursor or Uint8Array buffer from visitChildren)
 * @param visitor - Callback function called for each child cursor
 * @returns Array of child cursor buffers (Uint8Array) that can be passed to FFI functions
 */
export function visitChildren(
  cursor: CXCursor | Uint8Array,
  visitor: (cursor: CXCursor, parent: CXCursor) => CXChildVisitResult,
): Uint8Array[] {
  const sym = getSymbols();

  // Set the visitor function in global state
  setVisitor(visitor);

  // Create the native callback
  const visitorPtr = createVisitorCallback();

  sym.clang_visitChildren(
    toNativeCursor(cursor),
    visitorPtr,
    null as unknown as Deno.PointerValue,
  );

  // Clean up the callback to prevent memory leak
  if (
    currentCallback && typeof currentCallback === "object" &&
    "close" in currentCallback
  ) {
    (currentCallback as { close: () => void }).close();
    currentCallback = null;
  }

  // Get collected cursor buffers and clean up
  const buffers = getCollectedCursorBuffers();
  clearCollectedCursors();
  setVisitor(null);

  // Return the raw buffers - these can be passed to FFI functions like getCursorType
  return buffers;
}

// Store callback globally to prevent garbage collection during visitChildren
let currentCallback: unknown = null;

function createVisitorCallback(): Deno.PointerValue {
  // Close previous callback if exists
  if (
    currentCallback && typeof currentCallback === "object" &&
    "close" in currentCallback
  ) {
    (currentCallback as { close: () => void }).close();
    currentCallback = null;
  }

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
      _parentStruct: Uint8Array,
      _clientData: Deno.PointerValue,
    ): number => {
      // Parse CXCursor from the struct buffer
      const view = new DataView(
        cursorStruct.buffer,
        cursorStruct.byteOffset,
        cursorStruct.byteLength,
      );
      const kind = view.getUint32(0, true);
      const xdata = view.getInt32(4, true);
      const data0 = view.getBigUint64(8, true);
      const data1 = view.getBigUint64(16, true);
      const data2 = view.getBigUint64(24, true);

      // Create a native buffer that can be passed to FFI functions
      const nativeCursor = new NativeCXCursor(
        kind,
        xdata,
        data0,
        data1,
        data2,
      );
      const cursorBuffer = nativeCursor.getBuffer();

      // Get the CXCursor object for the visitor callback
      const cursor = nativeCursor.toCXCursor();

      // Get the parent cursor (not readily available from this callback signature)
      // We'll pass a null parent for now
      const parent: CXCursor = {
        kind: 0,
        xdata: 0,
        data: [
          null as unknown as Deno.PointerValue,
          null as unknown as Deno.PointerValue,
          null as unknown as Deno.PointerValue,
        ],
      };

      // Call the JS visitor function from global state
      const visitor = getVisitor();
      if (visitor) {
        const result = visitor(cursor, parent);

        // Collect the native buffer for later retrieval (can be passed to FFI)
        addCollectedCursorBuffer(cursorBuffer);

        // Return the result - Deno FFI inverts the return value for callback functions
        // returning i32. When the visitor returns 0 (Continue), it should continue
        // traversing, but Deno FFI inverts this. Inverting it back fixes the issue.
        const returnValue = result === 0 ? 1 : 0;
        return returnValue;
      }

      // If no visitor, return Continue
      return CXChildVisitResult.Continue;
    },
  );

  // Store callback globally for cleanup
  currentCallback = callback;

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
