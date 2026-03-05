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
 * Minimum required libclang major version
 */
const MIN_VERSION = 20;

/**
 * Maximum supported libclang major version
 * Used to detect when a newer (potentially incompatible) version is being used
 */
const MAX_VERSION = 20;

/**
 * Check if libclang is currently loaded
 *
 * @returns true if libclang is loaded, false otherwise
 */
export function isLoaded(): boolean {
  return symbols !== null;
}

/**
 * Get the libclang version string
 *
 * @returns The version string (e.g., "LLVM version 20.0.0")
 * @throws Error if libclang is not loaded
 */
export function getVersion(): string {
  if (!symbols) {
    throw new Error("libclang not loaded. Call load() first.");
  }

  const cxVersion = symbols.clang_getClangVersion();
  const cStr = symbols.clang_getCString(cxVersion);
  const version = cStr === null ? "" : Deno.UnsafePointerView.getCString(cStr);
  symbols.clang_disposeString(cxVersion);

  return version;
}

/**
 * Check that the loaded libclang version is at least v20
 *
 * @throws Error if libclang version is less than 20
 */
function checkVersion(): void {
  const version = getVersion();

  // Parse version from string like "LLVM version 20.0.0" or "clang version 20.0.0"
  const match = version.match(/(\d+)\./);
  if (!match) {
    throw new Error(
      `Unable to parse libclang version from "${version}". This library requires libclang v${MIN_VERSION}+.`,
    );
  }

  const majorVersion = parseInt(match[1], 10);

  if (majorVersion < MIN_VERSION) {
    throw new Error(
      `libclang v${majorVersion} detected, but this library requires v${MIN_VERSION}+. ` +
        `Please install libclang v${MIN_VERSION} or higher.`,
    );
  }

  // Warn if version is newer than tested
  if (majorVersion > MAX_VERSION) {
    console.warn(
      `Warning: libclang v${majorVersion} detected, but this library has only been tested up to v${MAX_VERSION}. ` +
        `Some features may not work correctly.`,
    );
  }
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

    // Check version after loading - unload if version check fails
    try {
      checkVersion();
    } catch (versionError) {
      // Close the library and clear symbols
      if (libclang !== null) {
        // @ts-ignore - Deno.dlopen signature
        libclang.close();
        libclang = null;
        symbols = null;
      }
      // Re-throw with context
      const originalError = versionError instanceof Error
        ? versionError
        : new Error(String(versionError));
      throw new Error(
        `libclang version check failed: ${originalError.message}`,
        { cause: originalError },
      );
    }
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
    cachedSymbols = null;
  }
  return true;
}

/**
 * Cached symbols reference for hot paths
 * This avoids repeated null checks in functions that are called thousands of times
 * (e.g., during AST traversal via visitChildren)
 */
let cachedSymbols: LibclangSymbols | null = null;

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
 * Get symbols with caching for hot paths
 *
 * This function caches the symbols reference after the first call,
 * eliminating null checks in performance-critical code paths.
 * Use this in functions that are called frequently (e.g., visitChildren callbacks).
 *
 * @returns The cached libclang symbols
 * @throws Error if libclang has not been loaded yet
 */
export function getSymbolsCached(): LibclangSymbols {
  if (cachedSymbols) {
    return cachedSymbols;
  }
  cachedSymbols = getSymbols();
  return cachedSymbols;
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
