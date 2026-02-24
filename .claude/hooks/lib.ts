// Shared utilities for Claude Code hooks
// Used by fmt.ts, lint.ts, and check.ts

export type HookInput = {
  cwd?: unknown;
  hook_event_name?: unknown;
  tool_name?: unknown;
  tool_input?: unknown;
};

export type PostToolUseHookOutput = {
  decision: "block";
  reason: string;
  suppressOutput?: boolean;
  hookSpecificOutput: {
    hookEventName: "PostToolUse";
    additionalContext: string;
  };
};

export const MAX_CAPTURE_BYTES = 64 * 1024; // cap stdout and stderr each

export const DENO_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function readStdinText(): Promise<string> {
  // Hook input JSON arrives on stdin. (May be empty in some edge cases.)
  return await new Response(Deno.stdin.readable).text();
}

export async function readTextLimited(
  stream: ReadableStream<Uint8Array>,
  limitBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let captured = "";
  let used = 0;
  let truncated = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value || value.length === 0) continue;

    if (used >= limitBytes) {
      truncated = true;
      // Drain without storing to avoid blocking the child process.
      continue;
    }

    const remaining = limitBytes - used;
    if (value.length > remaining) {
      truncated = true;
      const slice = value.subarray(0, remaining);
      captured += decoder.decode(slice, { stream: true });
      used = limitBytes;
      continue; // keep draining
    }

    captured += decoder.decode(value, { stream: true });
    used += value.length;
  }

  captured += decoder.decode(); // flush decoder
  return { text: captured, truncated };
}

export function cmdDisplay(args: readonly string[]): string {
  return args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ");
}

export async function runCommand(
  args: readonly string[],
  cwd: string,
): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}> {
  const [bin, ...rest] = args;
  const child = new Deno.Command(bin, {
    args: rest,
    cwd,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  const [out, err, status] = await Promise.all([
    readTextLimited(child.stdout, MAX_CAPTURE_BYTES),
    readTextLimited(child.stderr, MAX_CAPTURE_BYTES),
    child.status,
  ]);

  return {
    code: status.code,
    stdout: out.text,
    stderr: err.text,
    stdoutTruncated: out.truncated,
    stderrTruncated: err.truncated,
  };
}

export function makeFailurePayload(params: {
  failingCmd: readonly string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  toolName?: string;
  filePathHint?: string;
}): PostToolUseHookOutput {
  const headerParts = [
    `❌ ${cmdDisplay(params.failingCmd)} failed (exit code ${params.exitCode})`,
    params.toolName ? `Tool: ${params.toolName}` : undefined,
    params.filePathHint ? `File: ${params.filePathHint}` : undefined,
  ].filter((x): x is string => typeof x === "string");

  const truncNote = params.stdoutTruncated || params.stderrTruncated
    ? "\n\n(Note: output was truncated.)"
    : "";

  const stdoutBlock = params.stdout.trim().length > 0
    ? `\n\n--- stdout ---\n${params.stdout.trimEnd()}`
    : "";
  const stderrBlock = params.stderr.trim().length > 0
    ? `\n\n--- stderr ---\n${params.stderr.trimEnd()}`
    : "";

  const body = `${
    headerParts.join("\n")
  }${stdoutBlock}${stderrBlock}${truncNote}`.trimEnd();

  return {
    decision: "block",
    reason: body,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: body,
    },
  };
}

export function tryGetFilePathHint(input: HookInput): string | undefined {
  if (!isRecord(input.tool_input)) return undefined;
  // Matches Claude Code tool input examples (tool_input.file_path).
  const fp = asString(input.tool_input["file_path"]);
  return fp;
}

export function isDenoFile(filePath: string | undefined): boolean {
  return filePath !== undefined &&
    DENO_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}
