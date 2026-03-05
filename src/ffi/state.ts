/**
 * Global state for AST traversal callbacks
 *
 * Manages state for the clang_visitChildren callback system
 * Uses a stack-based approach for re-entrant safety (nested visitChildren calls)
 */

import { bigintToPtrValue, POINTER_SIZE, readPtr } from "../utils/ffi.ts";
import type { CursorVisitor, CXCursor } from "./types.ts";

/**
 * Visit context - stores state for a single visitChildren call
 */
interface VisitContext {
  /** The visitor function */
  visitor: CursorVisitor | null;
  /** Whether to collect cursor buffers */
  collect: boolean;
  /** Collected cursor buffers */
  buffers: Uint8Array[];
}

/**
 * Stack of visit contexts for re-entrant safety
 */
const visitContextStack: VisitContext[] = [];

/**
 * Push a new visit context onto the stack
 */
export function pushVisitContext(context: VisitContext): void {
  visitContextStack.push(context);
}

/**
 * Pop the current visit context from the stack
 */
export function popVisitContext(): VisitContext | undefined {
  return visitContextStack.pop();
}

/**
 * Get the current visitor function from the top of the stack
 */
export function getVisitor(): CursorVisitor | null {
  const ctx = visitContextStack[visitContextStack.length - 1];
  return ctx?.visitor ?? null;
}

/**
 * Add a cursor buffer to the current context's collected results
 * Only adds if collection is enabled
 */
export function addCollectedCursorBuffer(buffer: Uint8Array): void {
  const ctx = visitContextStack[visitContextStack.length - 1];
  if (ctx?.collect) {
    ctx.buffers.push(buffer);
  }
}

/**
 * Get all collected cursor buffers from the current context
 */
export function getCollectedCursorBuffers(): Uint8Array[] {
  const ctx = visitContextStack[visitContextStack.length - 1];
  return ctx?.buffers ?? [];
}

/**
 * Clear collected cursors in the current context
 */
export function clearCollectedCursors(): void {
  const ctx = visitContextStack[visitContextStack.length - 1];
  if (ctx) {
    ctx.buffers = [];
  }
}

/**
 * Get whether collection is enabled in the current context
 */
export function shouldCollect(): boolean {
  const ctx = visitContextStack[visitContextStack.length - 1];
  return ctx?.collect ?? true;
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
      bigintToPtrValue(readPtr(view, 8)),
      bigintToPtrValue(readPtr(view, 8 + POINTER_SIZE)),
      bigintToPtrValue(readPtr(view, 8 + POINTER_SIZE * 2)),
    ],
  };
}
