/**
 * Library loading and management
 */

import { findLocalResourceDir, getLibclang } from "./locate.ts";
import { getLibclangSymbols } from "../ffi/symbols.ts";
import type { LibclangSymbols } from "../ffi/types.ts";

/**
 * Minimum required libclang major version
 */
const MIN_VERSION = 20;

/**
 * Maximum supported libclang major version
 * Used to detect when a newer (potentially incompatible) version is being used
 */
const MAX_VERSION = 22;

/**
 * Libclang library manager class
 *
 * Encapsulates library loading, symbol management, and caching.
 * This provides better testability and avoids module-level state.
 */
class LibclangLibrary {
  private libclang: unknown = null;
  private symbols: LibclangSymbols | null = null;
  private cachedSymbols: LibclangSymbols | null = null;
  private libclangPath: string | null = null;
  private majorVersion: number | null = null;
  private resourceDir: string | null | undefined = undefined;

  /**
   * Check if libclang is currently loaded
   *
   * @returns true if libclang is loaded, false otherwise
   */
  isLoaded(): boolean {
    return this.symbols !== null;
  }

  /**
   * Get the libclang version string
   *
   * @returns The version string (e.g., "LLVM version 20.0.0")
   * @throws Error if libclang is not loaded
   */
  getVersion(): string {
    if (!this.symbols) {
      throw new Error("libclang not loaded. Call load() first.");
    }

    const cxVersion = this.symbols.clang_getClangVersion();
    const cStr = this.symbols.clang_getCString(cxVersion);
    const version = cStr === null
      ? ""
      : Deno.UnsafePointerView.getCString(cStr);
    this.symbols.clang_disposeString(cxVersion);

    return version;
  }

  /**
   * Check that the loaded libclang version is at least v20
   *
   * @returns The parsed libclang major version
   * @throws Error if libclang version is less than 20
   */
  private checkVersion(): number {
    const version = this.getVersion();

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

    return majorVersion;
  }

  /**
   * Get the resolved libclang resource directory, if any.
   *
   * Returns the path passed to `parseTranslationUnit` via `-resource-dir`
   * (or `null` when resolution failed). Useful for debugging and for callers
   * that want to introspect what the library resolved.
   *
   * Resolution is lazy and cached for the lifetime of the loaded library: it
   * runs on the first call (or first {@link parseTranslationUnit} that needs
   * to auto-inject `-resource-dir`) and is skipped entirely when no caller
   * ever asks. This keeps {@link load} (and tests that only load without
   * parsing) fast at the cost of paying the resolution on first use.
   *
   * The hot path is inlined here so `parseTranslationUnit` pays only a
   * single property read + undefined check once the cache is warm.
   *
   * @throws Error if libclang has not been loaded yet
   */
  getLibraryResourceDir(): string | null {
    if (this.symbols === null) {
      throw new Error("libclang not loaded. Call load() first.");
    }
    const cached = this.resourceDir;
    if (cached !== undefined) return cached;
    const resolved = findLocalResourceDir({
      libclangPath: this.libclangPath ?? undefined,
      major: this.majorVersion ?? undefined,
    });
    this.resourceDir = resolved;
    return resolved;
  }

  /**
   * Load libclang library
   */
  private loadLibclang(libPath: string | undefined): void {
    if (this.libclang !== null) return;

    const actualPath = libPath || getLibclang();

    try {
      // @ts-ignore - Deno.dlopen signature
      this.libclang = Deno.dlopen(actualPath, getLibclangSymbols());
      // @ts-ignore - symbols access - use any to bypass strict type checking for FFI
      this.symbols = this.libclang.symbols as unknown as LibclangSymbols;
      this.libclangPath = actualPath;

      // Check version after loading - unload if version check fails
      try {
        this.majorVersion = this.checkVersion();
      } catch (versionError) {
        // Close the library and clear symbols
        if (this.libclang !== null) {
          // @ts-ignore - Deno.dlopen signature
          this.libclang.close();
          this.libclang = null;
          this.symbols = null;
          this.libclangPath = null;
          this.majorVersion = null;
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
  unload(): boolean {
    if (this.libclang !== null) {
      // @ts-ignore - Deno.dlopen signature
      this.libclang.close();
      this.libclang = null;
      this.symbols = null;
      this.cachedSymbols = null;
      this.libclangPath = null;
      this.majorVersion = null;
      this.resourceDir = undefined;
    }
    return true;
  }

  /**
   * Get the loaded libclang symbols
   *
   * @returns The libclang symbols object for making FFI calls
   * @throws Error if libclang has not been loaded yet
   */
  getSymbols(): LibclangSymbols {
    if (!this.symbols) {
      throw new Error("libclang not loaded. Call load() first.");
    }
    return this.symbols;
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
  getSymbolsCached(): LibclangSymbols {
    if (this.cachedSymbols) {
      return this.cachedSymbols as unknown as LibclangSymbols;
    }
    const symbols = this.getSymbols();
    this.cachedSymbols = symbols;
    return symbols;
  }

  /**
   * Load libclang from a specific path, or auto-detect if not provided
   *
   * @param libPath - Optional path to libclang library. If not provided, auto-detects
   * @throws Error if libclang cannot be loaded from the specified path
   */
  load(libPath?: string): void {
    // If library is already loaded, just return (idempotent)
    if (this.symbols !== null) {
      return;
    }

    // Library is not loaded, load it
    this.loadLibclang(libPath);
  }
}

// Singleton instance for the library
const library = new LibclangLibrary();

// Re-export functions from the singleton for backward compatibility

/**
 * Check if libclang is currently loaded
 *
 * @returns true if libclang is loaded, false otherwise
 */
export function isLoaded(): boolean {
  return library.isLoaded();
}

/**
 * Get the libclang version string
 *
 * @returns The version string (e.g., "LLVM version 20.0.0")
 * @throws Error if libclang is not loaded
 */
export function getVersion(): string {
  return library.getVersion();
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
  return library.unload();
}

/**
 * Get the loaded libclang symbols
 *
 * @returns The libclang symbols object for making FFI calls
 * @throws Error if libclang has not been loaded yet
 */
export function getSymbols(): LibclangSymbols {
  return library.getSymbols();
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
  return library.getSymbolsCached();
}

/**
 * Load libclang from a specific path, or auto-detect if not provided
 *
 * @param libPath - Optional path to libclang library. If not provided, auto-detects
 * @throws Error if libclang cannot be loaded from the specified path
 */
export function load(libPath?: string): void {
  library.load(libPath);
}

/**
 * Get the resolved libclang resource directory (e.g. `<prefix>/lib/clang/20/`).
 *
 * Resolved lazily on first call (and reused by `parseTranslationUnit`'s
 * auto-injection), so callers that never query it pay no cost at
 * {@link load} time. Returns `null` when no valid candidate could be
 * located.
 *
 * @throws Error if libclang has not been loaded yet
 */
export function getLibraryResourceDir(): string | null {
  return library.getLibraryResourceDir();
}
