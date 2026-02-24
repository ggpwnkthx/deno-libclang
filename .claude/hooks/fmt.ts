// Runs: deno fmt
// On failure: prints a JSON "decision: block" payload so Claude sees the output.
//
// Required permissions for this script (via deno run flags):
//   --allow-run=deno

import {
  asString,
  isDenoFile,
  isRecord,
  makeFailurePayload,
  readStdinText,
  runCommand,
  tryGetFilePathHint,
} from "./lib.ts";
import type { HookInput } from "./lib.ts";

const stdinText = (await readStdinText()).trim();

let hookInput: HookInput = {};
if (stdinText.length > 0) {
  try {
    const parsed: unknown = JSON.parse(stdinText);
    if (isRecord(parsed)) hookInput = parsed as HookInput;
  } catch {
    // If hook input isn't valid JSON, don't crash; just run in current cwd.
    hookInput = {};
  }
}

const cwd = asString(hookInput.cwd) ?? Deno.cwd();
const toolName = asString(hookInput.tool_name);
const filePathHint = tryGetFilePathHint(hookInput);

// Skip non-Deno files (only check .ts, .tsx, .js, .jsx, .mjs)
if (!isDenoFile(filePathHint)) {
  Deno.exit(0);
}

// Run deno fmt on the file or all files
const cmd = filePathHint ? ["deno", "fmt", filePathHint] : ["deno", "fmt"];

const res = await runCommand(cmd, cwd);
if (res.code !== 0) {
  const payload = makeFailurePayload({
    failingCmd: cmd,
    exitCode: res.code,
    stdout: res.stdout,
    stderr: res.stderr,
    stdoutTruncated: res.stdoutTruncated,
    stderrTruncated: res.stderrTruncated,
    toolName,
    filePathHint,
  });

  // IMPORTANT: stdout must be ONLY the JSON object for Claude Code to parse it.
  console.log(JSON.stringify(payload));
  Deno.exit(0);
}

// Success: no output (keeps Claude transcript clean), exit 0.
Deno.exit(0);
