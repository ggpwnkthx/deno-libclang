/**
 * libclang utility
 *
 * Locates locally installed libclang
 */

import { pathExists } from "../utils/platform.ts";

export interface Platform {
  os: "linux" | "darwin" | "windows";
  arch: "x86_64" | "aarch64" | "arm64" | "x64" | "x86";
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
 * Find locally installed libclang
 *
 * Searches common locations for libclang on the current system
 */
export function findLocalLibclang(): string | null {
  const platform = getPlatform();

  const libName = platform.os === "windows"
    ? "libclang.dll"
    : platform.os === "darwin"
    ? "libclang.dylib"
    : "libclang.so";

  // Try versioned LLVM paths first (most common for locally installed)
  const possiblePaths: string[] = [];

  if (platform.os === "linux") {
    // Debian/Ubuntu multiarch - check these first (most likely to work on modern systems)
    for (const ver of ["20"]) {
      possiblePaths.push(`/usr/lib/x86_64-linux-gnu/libclang-${ver}.so.1`);
      possiblePaths.push(`/usr/lib/aarch64-linux-gnu/libclang-${ver}.so.1`);
      // Also check /lib paths (older Debian/Ubuntu systems)
      possiblePaths.push(`/lib/x86_64-linux-gnu/libclang-${ver}.so.1`);
      possiblePaths.push(`/lib/aarch64-linux-gnu/libclang-${ver}.so.1`);
    }
    possiblePaths.push(`/usr/lib/x86_64-linux-gnu/${libName}`);
    possiblePaths.push(`/usr/lib/aarch64-linux-gnu/${libName}`);
    // Also check lib64
    possiblePaths.push(`/usr/lib64/${libName}`);
    possiblePaths.push(`/usr/lib64/${libName}.1`);
    // Check system LLVM installations
    for (const ver of ["20"]) {
      possiblePaths.push(`/usr/lib/llvm-${ver}/lib/${libName}`);
      possiblePaths.push(`/usr/lib/llvm-${ver}/lib/${libName}.1`);
      possiblePaths.push(`/usr/lib/llvm-${ver}/lib/libclang.so.1`);
      possiblePaths.push(`/usr/lib/llvm-${ver}/lib/libclang.so`);
      // LLVM 20+ uses libclang-X.so naming
      possiblePaths.push(`/usr/lib/llvm-${ver}/lib/libclang-${ver}.so.1`);
      possiblePaths.push(`/usr/lib/llvm-${ver}/lib/libclang-${ver}.so`);
    }
  } else if (platform.os === "darwin") {
    // Homebrew LLVM
    possiblePaths.push(`/usr/local/opt/llvm/lib/${libName}`);
    possiblePaths.push(`/opt/homebrew/opt/llvm/lib/${libName}`);
    // Apple Command Line Tools
    possiblePaths.push(
      `/Library/Developer/CommandLineTools/usr/lib/${libName}`,
    );
    // Xcode
    possiblePaths.push(
      `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/${libName}`,
    );
  } else if (platform.os === "windows") {
    // Common LLVM installation paths on Windows
    const programFiles = Deno.env.get("ProgramFiles") || "C:\\Program Files";
    const programFilesX86 = Deno.env.get("ProgramFiles(x86)") ||
      "C:\\Program Files (x86)";
    const localAppData = Deno.env.get("LOCALAPPDATA") || "";

    for (const base of [programFiles, programFilesX86, localAppData]) {
      for (const ver of ["20"]) {
        possiblePaths.push(`${base}\\LLVM\\lib\\${libName}`);
        possiblePaths.push(`${base}\\LLVM-${ver}\\bin\\${libName}`);
      }
    }
  }

  // Also try libclang.so.1 as a fallback (for systems where the symlink exists)
  if (platform.os === "linux") {
    possiblePaths.push("/usr/lib/libclang.so.1");
    possiblePaths.push("/usr/lib/libclang.so");
  } else if (platform.os === "darwin") {
    possiblePaths.push("/usr/lib/libclang.dylib");
  }

  for (const path of possiblePaths) {
    if (pathExists(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Get the path to locally installed libclang
 *
 * @throws Error if libclang is not found
 */
export function getLibclang(): string {
  const libPath = findLocalLibclang();
  if (!libPath) {
    throw new Error(
      "libclang not found. Please install it via your system's package manager (e.g., apt install libclang-dev, brew install llvm)",
    );
  }
  return libPath;
}
