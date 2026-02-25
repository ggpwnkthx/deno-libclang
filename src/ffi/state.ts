/**
 * Global state for AST traversal callbacks
 *
 * Manages state for the clang_visitChildren callback system
 */

import type { CursorVisitor, CXCursor } from "./types.ts";

// Global state to store visitor function and collected cursor buffers
let currentVisitor: CursorVisitor | null = null;
let collectedCursorBuffers: Uint8Array[] = [];

/**
 * Set the current visitor function
 */
export function setVisitor(visitor: CursorVisitor | null): void {
  currentVisitor = visitor;
  collectedCursorBuffers = [];
}

/**
 * Get the current visitor function
 */
export function getVisitor(): CursorVisitor | null {
  return currentVisitor;
}

/**
 * Add a cursor buffer to the collected results
 */
export function addCollectedCursorBuffer(buffer: Uint8Array): void {
  collectedCursorBuffers.push(buffer);
}

/**
 * Get all collected cursor buffers
 */
export function getCollectedCursorBuffers(): Uint8Array[] {
  return collectedCursorBuffers;
}

/**
 * Clear the collected cursors
 */
export function clearCollectedCursors(): void {
  collectedCursorBuffers = [];
}

/**
 * Parse a cursor buffer into a CXCursor object
 */
export function parseCursorBuffer(buffer: Uint8Array): CXCursor {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  return {
    kind: view.getUint32(0, true),
    xdata: view.getInt32(4, true),
    data: [
      view.getBigUint64(8, true) as unknown as Deno.PointerValue,
      view.getBigUint64(16, true) as unknown as Deno.PointerValue,
      view.getBigUint64(24, true) as unknown as Deno.PointerValue,
    ],
  };
}
