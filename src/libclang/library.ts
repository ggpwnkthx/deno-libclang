/**
 * Library loading and management
 */

import { getLibclang } from "./locate.ts";
import { getLibclangSymbols } from "../ffi/symbols.ts";
import type { LibclangSymbols } from "../ffi/types.ts";

// Global state
// Using unknown type to avoid lint error for dynamic library
let libclang: unknown = null;
let symbols: LibclangSymbols | null = null;

/**
 * Check if libclang is currently loaded
 *
 * @returns true if libclang is loaded, false otherwise
 */
export function isLoaded(): boolean {
  return symbols !== null;
}

/**
 * Load libclang library
 */
function loadLibclang(libPath: string | undefined): void {
  if (libclang !== null) return;

  const actualPath = libPath || getLibclang();

  try {
    // @ts-ignore - Deno.dlopen signature
    libclang = Deno.dlopen(actualPath, getLibclangSymbols());
    // @ts-ignore - symbols access - use any to bypass strict type checking for FFI
    symbols = libclang.symbols as unknown as LibclangSymbols;
  } catch (e) {
    // Preserve original error message and stack for better debugging
    const originalError = e instanceof Error ? e : new Error(String(e));
    throw new Error(
      `Failed to load libclang from ${actualPath}: ${originalError.message}`,
      { cause: originalError },
    );
  }
}

/**
 * Unload the libclang library
 *
 * Closes the dynamic library handle and clears all loaded symbols.
 * After calling this, any further FFI calls will fail until load() is called again.
 *
 * @returns true
 */
export function unload(): boolean {
  if (libclang !== null) {
    // @ts-ignore - Deno.dlopen signature
    libclang.close();
    libclang = null;
    symbols = null;
  }
  return true;
}

/**
 * Get the loaded libclang symbols
 *
 * @returns The libclang symbols object for making FFI calls
 * @throws Error if libclang has not been loaded yet
 */
export function getSymbols(): LibclangSymbols {
  if (!symbols) {
    throw new Error("libclang not loaded. Call load() first.");
  }
  return symbols;
}

/**
 * Load libclang from a specific path, or auto-detect if not provided
 *
 * @param libPath - Optional path to libclang library. If not provided, auto-detects
 * @throws Error if libclang cannot be loaded from the specified path
 */
export function load(libPath?: string): void {
  // If library is already loaded, just return (idempotent)
  if (symbols !== null) {
    return;
  }

  // Library is not loaded, load it
  loadLibclang(libPath);
}
