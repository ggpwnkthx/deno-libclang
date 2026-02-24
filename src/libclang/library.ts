/**
 * Library loading and management
 */

import { getLibclang } from "./locate.ts";
import { getLibclangSymbols } from "../ffi/symbols.ts";

// Global state
// Using unknown type to avoid lint error for dynamic library
let libclang: unknown = null;
let symbols: ReturnType<typeof getLibclangSymbols> | null = null;

/**
 * Load libclang library
 */
function loadLibclang(libPath: string | undefined): void {
  if (libclang !== null) return;

  const actualPath = libPath || getLibclang();

  try {
    // @ts-ignore - Deno.dlopen signature
    libclang = Deno.dlopen(actualPath, getLibclangSymbols());
    // @ts-ignore - symbols access
    symbols = libclang.symbols as ReturnType<typeof getLibclangSymbols>;
  } catch (e) {
    throw new Error(`Failed to load libclang from ${actualPath}: ${e}`);
  }
}

/**
 * Unload libclang library
 */
export function unload(): void {
  if (libclang !== null) {
    // @ts-ignore - Deno.dlopen signature
    libclang.close();
    libclang = null;
    symbols = null;
  }
}

/**
 * Ensure symbols are loaded
 */
export function getSymbols(): ReturnType<typeof getLibclangSymbols> {
  if (!symbols) {
    throw new Error("libclang not loaded. Call loadLibclang() first.");
  }
  return symbols;
}

/**
 * Load libclang from a specific path, or auto-detect if not provided
 */
export function load(libPath?: string): void {
  loadLibclang(libPath);
}
