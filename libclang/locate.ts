/**
 * libclang utility
 *
 * Locates locally installed libclang
 */

import { dirExists, pathExists } from "../utils/platform.ts";

/**
 * Platform information interface
 */
export interface Platform {
  /** Operating system */
  os: "linux" | "darwin" | "windows";
  /** CPU architecture */
  arch: "x86_64" | "aarch64" | "arm64" | "x64" | "x86";
  /** Archive extension */
  ext: "tar.xz" | "zip";
}

/**
 * Detect the current platform (OS and architecture)
 */
export function getPlatform(): Platform {
  const os = Deno.build.os;

  let arch: Platform["arch"];
  const buildArch = Deno.build.arch as string;
  switch (buildArch) {
    case "x86_64":
      arch = os === "windows" ? "x64" : "x86_64";
      break;
    case "aarch64":
      arch = "aarch64";
      break;
    case "arm64":
      arch = "arm64";
      break;
    case "x86":
      arch = "x86";
      break;
    default:
      throw new Error(`Unsupported architecture: ${buildArch}`);
  }

  let osName: Platform["os"];
  switch (os) {
    case "linux":
      osName = "linux";
      break;
    case "darwin":
      osName = "darwin";
      break;
    case "windows":
      osName = "windows";
      break;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }

  return {
    os: osName,
    arch,
    ext: osName === "windows" ? "zip" : "tar.xz",
  };
}

/**
 * LLVM versions probed for versioned install directories.
 */
const LLVM_VERSIONS: readonly string[] = [
  "3.5",
  "3.6",
  "3.7",
  "3.8",
  "3.9",
  "4.0",
  "5.0",
  "6.0",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
];

/**
 * Versioned Homebrew formulae we probe via `brew --prefix` when "llvm"
 * itself isn't installed. Newest first so we find a match quickly.
 */
const HOMEBREW_VERSIONED_FORMULAE: readonly string[] = [
  "22",
  "21",
  "20",
  "19",
  "18",
  "17",
  "16",
  "15",
  "14",
  "13",
  "12",
  "11",
  "10",
];

/**
 * Platform-specific library filename for libclang
 */
function getLibclangLibName(os: Platform["os"]): string {
  if (os === "windows") return "libclang.dll";
  if (os === "darwin") return "libclang.dylib";
  return "libclang.so";
}

/**
 * Brew `opt/` base directories to scan for installed formulae, per platform.
 *
 * macOS Homebrew:
 *   - `/opt/homebrew/opt` (Apple Silicon default)
 *   - `/usr/local/opt`    (Intel default)
 *
 * Linuxbrew:
 *   - `/home/linuxbrew/.linuxbrew/opt` (multi-user install)
 *   - `$HOMEBREW_PREFIX/opt` when set
 *   - `$HOME/.linuxbrew/opt`            (per-user install)
 *
 * Filesystem-only; absence of any base directory is not an error.
 */
function getBrewOptBases(): string[] {
  const out: string[] = [];
  if (Deno.build.os === "darwin") {
    out.push("/opt/homebrew/opt", "/usr/local/opt");
  } else if (Deno.build.os === "linux") {
    out.push("/home/linuxbrew/.linuxbrew/opt");
    const homebrewPrefix = Deno.env.get("HOMEBREW_PREFIX");
    if (homebrewPrefix) out.push(`${homebrewPrefix}/opt`);
    const home = Deno.env.get("HOME");
    if (home) out.push(`${home}/.linuxbrew/opt`);
  }
  return out;
}

/**
 * A locating strategy returns candidate paths to try, in priority order.
 */
type Strategy = () => string[];

/**
 * Run a command synchronously; swallow all errors and return stdout.
 *
 * Used by strategies that shell out to tools like `brew` and `clang`.
 * Returns the empty string on any failure (missing binary, denied
 * permission, non-zero exit, etc.) so callers can fall through to the
 * next strategy without try/catch noise.
 */
function safeRun(cmd: string, args: readonly string[]): string {
  try {
    const c = new Deno.Command(cmd, {
      args: [...args],
      stderr: "null",
      stdout: "piped",
    });
    const out = c.outputSync();
    if (!out.success) return "";
    return new TextDecoder().decode(out.stdout).trim();
  } catch {
    return "";
  }
}

/**
 * List executable files with `name` reachable via PATH.
 */
function findOnPath(name: string): string[] {
  const pathEnv = Deno.env.get("PATH") ?? "";
  const sep = Deno.build.os === "windows" ? ";" : ":";
  const slash = Deno.build.os === "windows" ? "\\" : "/";
  const exts = Deno.build.os === "windows"
    ? [".exe", ".cmd", ".bat", ""]
    : [""];
  const out: string[] = [];
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = `${dir}${slash}${name}${ext}`;
      if (pathExists(candidate)) out.push(candidate);
    }
  }
  return out;
}

/**
 * List directory entry names; swallow errors.
 */
function readDirNames(path: string): string[] {
  try {
    const names: string[] = [];
    for (const entry of Deno.readDirSync(path)) {
      names.push(entry.name);
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * Honor LIBCLANG_LIBRARY_PATH, LLVM_HOME, and LIBCLANG_PATH.
 *
 * These are the same conventions used by libclang itself, clangd, and
 * LLVM's CMake config; honoring them lets users and CI pin a path
 * without code changes.
 */
function envOverrideStrategy(platform: Platform): string[] {
  const libName = getLibclangLibName(platform.os);
  const out: string[] = [];

  const libclangLibPath = Deno.env.get("LIBCLANG_LIBRARY_PATH");
  if (libclangLibPath) out.push(libclangLibPath);

  const llvmHome = Deno.env.get("LLVM_HOME");
  if (llvmHome) {
    if (platform.os === "windows") {
      out.push(
        `${llvmHome}\\bin\\${libName}`,
        `${llvmHome}\\lib\\${libName}`,
      );
    } else {
      out.push(
        `${llvmHome}/lib/${libName}`,
        `${llvmHome}/lib/${libName}.1`,
        `${llvmHome}/lib/libclang.so.1`,
      );
    }
  }

  const libclangPath = Deno.env.get("LIBCLANG_PATH");
  if (libclangPath) {
    out.push(libclangPath);
    if (dirExists(libclangPath)) {
      out.push(
        `${libclangPath}/${libName}`,
        `${libclangPath}/${libName}.1`,
      );
    }
  }

  return out;
}

let clangStrategyCache: { tried: boolean; result: string } = {
  tried: false,
  result: "",
};

/**
 * Ask clang itself where libclang lives via `-print-file-name`.
 *
 * Most accurate strategy: it returns the libclang that matches the
 * clang toolchain on PATH. Requires `--allow-run` to actually execute
 * the binary; without it, the strategy silently returns no candidates.
 */
function clangPrintFileNameStrategy(platform: Platform): string[] {
  if (clangStrategyCache.tried) {
    return clangStrategyCache.result ? [clangStrategyCache.result] : [];
  }
  clangStrategyCache.tried = true;

  const ext = platform.os === "windows"
    ? "dll"
    : platform.os === "darwin"
    ? "dylib"
    : "so";

  for (const clangPath of findOnPath("clang")) {
    const stdout = safeRun(clangPath, [`-print-file-name=libclang.${ext}`]);
    if (stdout && pathExists(stdout)) {
      clangStrategyCache.result = stdout;
      return [stdout];
    }
  }
  return [];
}

const brewFormulaPrefixCache: Record<string, string> = {};

/**
 * Resolve the Homebrew prefix for a formula via `brew --prefix`.
 * Results are memoized per formula for the lifetime of the process.
 */
function resolveBrewPrefix(formula: string): string {
  if (formula in brewFormulaPrefixCache) {
    return brewFormulaPrefixCache[formula];
  }
  const out = safeRun("brew", ["--prefix", formula]);
  brewFormulaPrefixCache[formula] = out;
  return out;
}

/**
 * On macOS or Linux, use `brew --prefix llvm` (and versioned variants) to
 * find the install location. Requires `--allow-run`; falls through silently
 * otherwise.
 */
function homebrewPrefixStrategy(platform: Platform): string[] {
  const os = platform.os;
  if (os !== "darwin" && os !== "linux") return [];
  if (findOnPath("brew").length === 0) return [];

  const libName = getLibclangLibName(os);
  const out: string[] = [];

  const unversioned = resolveBrewPrefix("llvm");
  if (unversioned) {
    out.push(
      `${unversioned}/lib/${libName}`,
      `${unversioned}/lib/${libName}.1`,
    );
  }

  for (const ver of HOMEBREW_VERSIONED_FORMULAE) {
    const prefix = resolveBrewPrefix(`llvm@${ver}`);
    if (prefix) {
      out.push(`${prefix}/lib/${libName}`, `${prefix}/lib/${libName}.1`);
    }
  }

  return out;
}

/**
 * On macOS or Linux, scan Homebrew/Linuxbrew `opt/` directories for any
 * installed `llvm` or `llvm@<v>` formulae. Filesystem-only; no subprocess
 * required.
 *
 * This catches installations that `brew --prefix` cannot enumerate
 * (custom taps, per-user Linuxbrew installs, stale state) without depending
 * on `--allow-run`. Bases come from {@link getBrewOptBases}.
 */
function homebrewOptGlobStrategy(platform: Platform): string[] {
  const os = platform.os;
  if (os !== "darwin" && os !== "linux") return [];

  const libName = getLibclangLibName(os);
  const out: string[] = [];

  for (const base of getBrewOptBases()) {
    if (!dirExists(base)) continue;
    for (const name of readDirNames(base)) {
      if (!/^llvm(@\d+(\.\d+)?)?$/.test(name)) continue;
      out.push(
        `${base}/${name}/lib/${libName}`,
        `${base}/${name}/lib/${libName}.1`,
      );
    }
  }

  return out;
}

/**
 * Linux: Debian/Ubuntu multiarch, system LLVM under /usr/lib/llvm-<V>/lib,
 * /opt manual installs, standard lib/lib64 fallbacks, and Linuxbrew
 * (`/home/linuxbrew/.linuxbrew`, `$HOMEBREW_PREFIX`, `$HOME/.linuxbrew`).
 */
function linuxCandidates(platform: Platform): string[] {
  const libName = getLibclangLibName(platform.os);
  const out: string[] = [];

  for (const ver of LLVM_VERSIONS) {
    out.push(
      `/usr/lib/x86_64-linux-gnu/libclang-${ver}.so.1`,
      `/usr/lib/aarch64-linux-gnu/libclang-${ver}.so.1`,
      `/lib/x86_64-linux-gnu/libclang-${ver}.so.1`,
      `/lib/aarch64-linux-gnu/libclang-${ver}.so.1`,
    );
  }

  out.push(
    `/usr/lib/x86_64-linux-gnu/${libName}`,
    `/usr/lib/aarch64-linux-gnu/${libName}`,
    `/usr/lib64/${libName}`,
    `/usr/lib64/${libName}.1`,
    `/usr/lib/${libName}`,
    `/usr/lib/${libName}.1`,
    `/usr/local/lib/${libName}`,
    `/usr/local/lib/${libName}.1`,
    `/usr/local/lib64/${libName}`,
    `/usr/local/lib64/${libName}.1`,
  );

  for (const ver of LLVM_VERSIONS) {
    out.push(
      `/usr/lib/llvm-${ver}/lib/${libName}`,
      `/usr/lib/llvm-${ver}/lib/${libName}.1`,
      `/usr/lib/llvm-${ver}/lib/libclang.so.1`,
      `/usr/lib/llvm-${ver}/lib/libclang.so`,
      `/usr/lib/llvm-${ver}/lib/libclang-${ver}.so.1`,
      `/usr/lib/llvm-${ver}/lib/libclang-${ver}.so`,
    );
  }

  out.push(`/opt/llvm/lib/${libName}`, `/opt/llvm/lib/${libName}.1`);
  for (const ver of LLVM_VERSIONS) {
    out.push(
      `/opt/llvm-${ver}/lib/${libName}`,
      `/opt/llvm-${ver}/lib/${libName}.1`,
    );
  }

  // Linuxbrew fallbacks (multi-user and per-user). These are static
  // paths; the dynamic `homebrewOptGlobStrategy` covers installed
  // formula names like `llvm@20`.
  out.push(
    `/home/linuxbrew/.linuxbrew/lib/${libName}`,
    `/home/linuxbrew/.linuxbrew/lib/${libName}.1`,
  );
  const homebrewPrefix = Deno.env.get("HOMEBREW_PREFIX");
  if (homebrewPrefix) {
    out.push(
      `${homebrewPrefix}/lib/${libName}`,
      `${homebrewPrefix}/lib/${libName}.1`,
    );
  }
  const home = Deno.env.get("HOME");
  if (home) {
    out.push(
      `${home}/.linuxbrew/lib/${libName}`,
      `${home}/.linuxbrew/lib/${libName}.1`,
    );
  }

  return out;
}

/**
 * macOS: Apple Command Line Tools, Xcode toolchain, system fallback.
 * Homebrew is handled by `homebrewPrefixStrategy` and
 * `homebrewOptGlobStrategy` so it isn't repeated here.
 */
function darwinCandidates(platform: Platform): string[] {
  const libName = getLibclangLibName(platform.os);
  return [
    `/Library/Developer/CommandLineTools/usr/lib/${libName}`,
    `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/${libName}`,
    `/usr/lib/${libName}`,
  ];
}

/**
 * Windows: libclang.dll lives in bin\ for the LLVM installer.
 * Probed in priority order: LLVM-<V>\bin, LLVM\bin, then lib\.
 */
function windowsCandidates(platform: Platform): string[] {
  const libName = getLibclangLibName(platform.os);
  const programFiles = Deno.env.get("ProgramFiles") || "C:\\Program Files";
  const programFilesX86 = Deno.env.get("ProgramFiles(x86)") ||
    "C:\\Program Files (x86)";
  const localAppData = Deno.env.get("LOCALAPPDATA") || "";

  const out: string[] = [];
  for (const base of [programFiles, programFilesX86, localAppData]) {
    for (const ver of LLVM_VERSIONS) {
      out.push(`${base}\\LLVM-${ver}\\bin\\${libName}`);
      out.push(`${base}\\LLVM-${ver}\\lib\\${libName}`);
    }
    out.push(`${base}\\LLVM\\bin\\${libName}`);
    out.push(`${base}\\LLVM\\lib\\${libName}`);
  }
  return out;
}

/**
 * Pick the per-OS static candidate list.
 */
function systemCandidatesForOS(platform: Platform): string[] {
  switch (platform.os) {
    case "linux":
      return linuxCandidates(platform);
    case "darwin":
      return darwinCandidates(platform);
    case "windows":
      return windowsCandidates(platform);
  }
}

/**
 * Ordered list of strategies for the current OS.
 */
function strategiesForOS(platform: Platform): Strategy[] {
  const list: Strategy[] = [
    () => envOverrideStrategy(platform),
    () => clangPrintFileNameStrategy(platform),
  ];
  const os = platform.os;
  if (os === "darwin" || os === "linux") {
    list.push(() => homebrewPrefixStrategy(platform));
    list.push(() => homebrewOptGlobStrategy(platform));
  }
  list.push(() => systemCandidatesForOS(platform));
  return list;
}

let resolvedCache: { value: string | null | undefined } = { value: undefined };

/**
 * Clear all internal caches (resolved path, subprocess results).
 * Exposed for tests and hot-reload scenarios.
 */
export function clearLibclangCache(): void {
  resolvedCache = { value: undefined };
  resolvedResourceDirCache = { value: undefined };
  clangStrategyCache = { tried: false, result: "" };
  clangPrintResourceDirCache = { tried: false, result: "" };
  for (const k of Object.keys(brewFormulaPrefixCache)) {
    delete brewFormulaPrefixCache[k];
  }
}

/**
 * Compute the full list of candidate paths the locator will try, in order.
 * Exposed for debugging and tests.
 */
export function getLibclangCandidates(): string[] {
  const platform = getPlatform();
  const out: string[] = [];
  for (const strategy of strategiesForOS(platform)) {
    out.push(...strategy());
  }
  return out;
}

/**
 * Find locally installed libclang.
 *
 * Runs a sequence of strategies (env vars, `clang -print-file-name`,
 * `brew --prefix`, Homebrew opt glob, per-OS well-known paths) and
 * returns the first candidate that exists.
 */
export function findLocalLibclang(): string | null {
  if (resolvedCache.value !== undefined) {
    return resolvedCache.value;
  }
  for (const path of getLibclangCandidates()) {
    if (path && pathExists(path)) {
      resolvedCache.value = path;
      return path;
    }
  }
  resolvedCache.value = null;
  return null;
}

/**
 * Get the path to locally installed libclang.
 *
 * @throws Error if libclang is not found
 */
export function getLibclang(): string {
  const libPath = findLocalLibclang();
  if (!libPath) {
    throw new Error(
      "libclang not found. Install it via your package manager (e.g. " +
        "`apt install libclang-dev`, `brew install llvm`) or set " +
        "LIBCLANG_LIBRARY_PATH / LLVM_HOME to its location.",
    );
  }
  return libPath;
}

// ============================================================================
// Resource directory resolution
// ============================================================================

/**
 * Options for {@link findLocalResourceDir}.
 */
export interface FindResourceDirOptions {
  /** Path to the loaded libclang; used to derive a dylib-relative fallback. */
  libclangPath?: string;
  /** libclang major version (e.g. 20). When omitted, derived from the file name. */
  major?: number;
}

/**
 * Well-known builtin-header filenames that the validator probes for.
 *
 * A directory is considered a valid resource directory only if at least one of
 * these is present under `include/`. This avoids picking up unrelated
 * directories like `/usr/lib/clang` that happen to exist on some systems.
 */
const RESOURCE_DIR_SENTINELS: readonly string[] = [
  "include/stddef.h",
  "include/stdarg.h",
  "include/stdint.h",
];

/**
 * Whether `dir` looks like a usable libclang resource directory.
 *
 * True when the directory contains at least one well-known builtin header
 * under `include/`. False otherwise (including when the directory itself
 * doesn't exist).
 */
export function isValidResourceDir(dir: string): boolean {
  if (!dirExists(dir)) return false;
  for (const rel of RESOURCE_DIR_SENTINELS) {
    if (pathExists(`${dir}/${rel}`)) return true;
  }
  return false;
}

/**
 * Honor the LIBCLANG_RESOURCE_DIR environment variable when set.
 */
function envOverrideResourceStrategy(): string[] {
  const override = Deno.env.get("LIBCLANG_RESOURCE_DIR");
  if (override) return [override];
  return [];
}

let clangPrintResourceDirCache: { tried: boolean; result: string } = {
  tried: false,
  result: "",
};

/**
 * Ask `clang` itself where the resource directory lives via
 * `-print-resource-dir`. Most accurate when a usable `clang` is on PATH.
 *
 * Requires `--allow-run`. Without it, the strategy silently returns no
 * candidates. Memoized for the lifetime of the process.
 */
function clangPrintResourceDirStrategy(_platform: Platform): string[] {
  if (clangPrintResourceDirCache.tried) {
    return clangPrintResourceDirCache.result
      ? [clangPrintResourceDirCache.result]
      : [];
  }
  clangPrintResourceDirCache.tried = true;

  for (const clangPath of findOnPath("clang")) {
    const stdout = safeRun(clangPath, ["-print-resource-dir"]);
    if (stdout) {
      const trimmed = stdout.trim();
      if (trimmed) {
        clangPrintResourceDirCache.result = trimmed;
        return [trimmed];
      }
    }
  }
  return [];
}

/**
 * On macOS or Linux, derive `<brew-prefix>/lib/clang/<MAJOR>/` from
 * `brew --prefix`. Mirrors `homebrewPrefixStrategy` so we can use the same
 * prefix cache.
 */
function homebrewResourceDirStrategy(platform: Platform): string[] {
  const os = platform.os;
  if (os !== "darwin" && os !== "linux") return [];
  if (findOnPath("brew").length === 0) return [];

  const out: string[] = [];

  const unversioned = resolveBrewPrefix("llvm");
  if (unversioned) {
    for (const ver of LLVM_VERSIONS) {
      out.push(`${unversioned}/lib/clang/${ver}`);
    }
  }

  for (const ver of HOMEBREW_VERSIONED_FORMULAE) {
    const prefix = resolveBrewPrefix(`llvm@${ver}`);
    if (prefix) {
      out.push(`${prefix}/lib/clang/${ver}`);
    }
  }

  return out;
}

/**
 * On macOS or Linux, scan Homebrew/Linuxbrew `opt/` directories for any
 * installed `llvm` or `llvm@<v>` formulae and emit
 * `<opt>/llvm[@<v>]/lib/clang/<MAJOR>/` for each known LLVM major version.
 * Filesystem-only.
 */
function homebrewOptResourceDirStrategy(platform: Platform): string[] {
  const os = platform.os;
  if (os !== "darwin" && os !== "linux") return [];

  const out: string[] = [];

  for (const base of getBrewOptBases()) {
    if (!dirExists(base)) continue;
    for (const name of readDirNames(base)) {
      if (!/^llvm(@\d+(\.\d+)?)?$/.test(name)) continue;
      for (const ver of LLVM_VERSIONS) {
        out.push(`${base}/${name}/lib/clang/${ver}`);
      }
    }
  }

  return out;
}

/**
 * Linux: Debian/Ubuntu multiarch, system LLVM under /usr/lib/llvm-<V>/,
 * /opt manual installs, and Linuxbrew
 * (`/home/linuxbrew/.linuxbrew`, `$HOMEBREW_PREFIX`, `$HOME/.linuxbrew`).
 */
function linuxResourceDirCandidates(_platform: Platform): string[] {
  const out: string[] = [];

  for (const ver of LLVM_VERSIONS) {
    out.push(
      `/usr/lib/llvm-${ver}/lib/clang/${ver}`,
      `/usr/lib/x86_64-linux-gnu/clang/${ver}`,
      `/usr/lib/aarch64-linux-gnu/clang/${ver}`,
      `/lib/x86_64-linux-gnu/clang/${ver}`,
      `/lib/aarch64-linux-gnu/clang/${ver}`,
      `/usr/local/clang/${ver}`,
    );
  }

  out.push(`/opt/llvm/lib/clang/20`, `/usr/local/lib/clang/20`);
  for (const ver of LLVM_VERSIONS) {
    out.push(`/opt/llvm-${ver}/lib/clang/${ver}`);
  }

  // Linuxbrew fallbacks (multi-user and per-user). The dynamic
  // `homebrewOptResourceDirStrategy` covers per-formula paths.
  out.push(`/home/linuxbrew/.linuxbrew/lib/clang/20`);
  const homebrewPrefix = Deno.env.get("HOMEBREW_PREFIX");
  if (homebrewPrefix) {
    out.push(`${homebrewPrefix}/lib/clang/20`);
  }
  const home = Deno.env.get("HOME");
  if (home) {
    out.push(`${home}/.linuxbrew/lib/clang/20`);
  }

  return out;
}

/**
 * macOS: Apple Command Line Tools and Xcode bundled clang ship a resource
 * directory too. Homebrew is handled separately.
 */
function darwinResourceDirCandidates(_platform: Platform): string[] {
  const out: string[] = [];
  for (const ver of LLVM_VERSIONS) {
    out.push(
      `/Library/Developer/CommandLineTools/usr/lib/clang/${ver}`,
      `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/clang/${ver}`,
      `/usr/lib/clang/${ver}`,
    );
  }
  return out;
}

/**
 * Windows: libclang ships inside the LLVM install under `lib\clang\<V>`.
 */
function windowsResourceDirCandidates(_platform: Platform): string[] {
  const programFiles = Deno.env.get("ProgramFiles") || "C:\\Program Files";
  const programFilesX86 = Deno.env.get("ProgramFiles(x86)") ||
    "C:\\Program Files (x86)";
  const localAppData = Deno.env.get("LOCALAPPDATA") || "";

  const out: string[] = [];
  for (const base of [programFiles, programFilesX86, localAppData]) {
    for (const ver of LLVM_VERSIONS) {
      out.push(`${base}\\LLVM-${ver}\\lib\\clang\\${ver}`);
    }
    out.push(`${base}\\LLVM\\lib\\clang\\20`);
  }
  return out;
}

function systemResourceDirCandidatesForOS(platform: Platform): string[] {
  switch (platform.os) {
    case "linux":
      return linuxResourceDirCandidates(platform);
    case "darwin":
      return darwinResourceDirCandidates(platform);
    case "windows":
      return windowsResourceDirCandidates(platform);
  }
}

/**
 * Derive a candidate from the loaded libclang path. The install layout puts
 * the resource directory two levels up from the dylib in `lib/clang/<MAJOR>/`,
 * e.g. `.../lib/libclang.dylib` ⇒ `.../lib/clang/<MAJOR>/`.
 */
function dylibRelativeResourceDirStrategy(
  libclangPath: string | undefined,
  major: number | undefined,
): string[] {
  if (!libclangPath || major === undefined) return [];
  const sep = libclangPath.includes("\\") ? "\\" : "/";
  const parent = libclangPath.substring(
    0,
    libclangPath.lastIndexOf(sep),
  );
  const grand = parent.substring(0, parent.lastIndexOf(sep));
  return [`${grand}${sep}lib${sep}clang${sep}${major}`];
}

function resourceDirStrategiesForOS(
  platform: Platform,
  opts: FindResourceDirOptions,
): Strategy[] {
  const list: Strategy[] = [
    () => envOverrideResourceStrategy(),
    () => clangPrintResourceDirStrategy(platform),
  ];
  const os = platform.os;
  if (os === "darwin" || os === "linux") {
    list.push(() => homebrewResourceDirStrategy(platform));
    list.push(() => homebrewOptResourceDirStrategy(platform));
  }
  list.push(() => systemResourceDirCandidatesForOS(platform));
  list.push(() =>
    dylibRelativeResourceDirStrategy(opts.libclangPath, opts.major)
  );
  return list;
}

let resolvedResourceDirCache: { value: string | null | undefined } = {
  value: undefined,
};

/**
 * Compute the full list of candidate paths the resource-directory locator
 * will try, in order. Exposed for debugging and tests.
 */
export function findResourceDirCandidates(
  opts: FindResourceDirOptions = {},
): string[] {
  const platform = getPlatform();
  const out: string[] = [];
  for (const strategy of resourceDirStrategiesForOS(platform, opts)) {
    out.push(...strategy());
  }
  return out;
}

/**
 * Find the locally installed libclang resource directory.
 *
 * Runs a sequence of strategies (LIBCLANG_RESOURCE_DIR env override,
 * `clang -print-resource-dir`, Homebrew formulae, per-OS well-known paths,
 * and a libclang-dylib-relative fallback) and returns the first candidate
 * that contains a recognizable builtin header (e.g. `include/stddef.h`).
 *
 * Returns `null` if no candidate is valid. Cached for the lifetime of the
 * process; use {@link clearLibclangCache} to invalidate.
 */
export function findLocalResourceDir(
  opts: FindResourceDirOptions = {},
): string | null {
  if (resolvedResourceDirCache.value !== undefined) {
    return resolvedResourceDirCache.value;
  }
  for (const path of findResourceDirCandidates(opts)) {
    if (path && isValidResourceDir(path)) {
      resolvedResourceDirCache.value = path;
      return path;
    }
  }
  resolvedResourceDirCache.value = null;
  return null;
}

/**
 * Get the resource directory path. Throws if it cannot be located.
 */
export function getResourceDir(): string {
  const dir = findLocalResourceDir();
  if (!dir) {
    throw new Error(
      "libclang resource directory not found. Set LIBCLANG_RESOURCE_DIR to " +
        "the directory containing include/stddef.h (typically " +
        "<llvm-prefix>/lib/clang/<major>/).",
    );
  }
  return dir;
}
