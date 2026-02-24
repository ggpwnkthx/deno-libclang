/**
 * Shared platform utilities for library finding
 *
 * Provides common platform detection and file system checking
 * used across multiple modules.
 */

/**
 * Get the library filename based on the current platform
 */
export function getPlatformLibName(libName: string): string {
  const os = Deno.build.os;

  if (os === "windows") {
    return `${libName}.dll`;
  } else if (os === "darwin") {
    return `${libName}.dylib`;
  } else if (os === "linux") {
    return `${libName}.so`;
  }

  throw new Error(`Unsupported operating system: ${os}`);
}

/**
 * Get common library paths for the current OS
 */
export function getCommonLibPaths(): string[] {
  const os = Deno.build.os;
  const paths: string[] = [];

  if (os === "linux") {
    paths.push(
      "/usr/lib",
      "/usr/local/lib",
      "/usr/lib64",
      "/usr/lib/x86_64-linux-gnu",
      "/usr/lib/aarch64-linux-gnu",
    );
  } else if (os === "darwin") {
    paths.push(
      "/usr/local/lib",
      "/opt/homebrew/lib",
      "/Library/Frameworks",
    );
    // Add homebrew opt paths for common packages
    paths.push("/usr/local/opt/*/lib");
    paths.push("/opt/homebrew/opt/*/lib");
  } else if (os === "windows") {
    const programFiles = Deno.env.get("ProgramFiles") || "C:\\Program Files";
    const programFilesX86 = Deno.env.get("ProgramFiles(x86)") ||
      "C:\\Program Files (x86)";
    paths.push(
      "C:\\Windows\\System32",
      programFiles,
      programFilesX86,
    );
  }

  return paths;
}

/**
 * Check if a path exists and is a file (or symlink)
 */
export function pathExists(path: string): boolean {
  try {
    const stat = Deno.statSync(path);
    return stat.isFile || stat.isSymlink;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export function dirExists(path: string): boolean {
  try {
    const stat = Deno.statSync(path);
    return stat.isDirectory;
  } catch {
    return false;
  }
}
