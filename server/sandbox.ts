import { spawn } from "child_process";

/**
 * Run user-supplied Python or SQL against an in-memory dataframe by
 * shelling out to `engine.sandbox.json_worker`. The child process applies
 * OS-level resource limits, blocks the network, strips its environment,
 * and chdirs into a fresh tmpdir before executing — see
 * `engine/sandbox/worker.py` for the full hardening list.
 *
 * The protocol matches the in-process behaviour the previous inline
 * Python scripts implemented, so callers can drop in without changes:
 * records in, transformed records out, error string on failure.
 */
export interface SandboxResult {
  data?: Record<string, unknown>[];
  error?: string;
}

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const SANDBOX_TIMEOUT_MS = parseInt(process.env.SANDBOX_TIMEOUT_MS ?? "60000", 10);

export function runSandboxedPython(
  code: string,
  records: unknown[],
): Promise<SandboxResult> {
  return run("python", code, records);
}

export function runSandboxedSql(
  query: string,
  records: unknown[],
): Promise<SandboxResult> {
  return run("sql", query, records);
}

function run(kind: "python" | "sql", code: string, records: unknown[]): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BIN, ["-m", "engine.sandbox.json_worker"], {
      env: {
        // Match what runner.py passes to the parquet worker — minimum
        // viable env. The worker also re-strips defensively.
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PYTHONPATH: process.env.PYTHONPATH ?? process.cwd(),
        PYTHONIOENCODING: "utf-8",
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (value: SandboxResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve(value);
    };

    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
      settle({ error: `Sandbox exceeded ${Math.round(SANDBOX_TIMEOUT_MS / 1000)}s timeout` });
    }, SANDBOX_TIMEOUT_MS);

    child.stdin.on("error", () => {});
    child.stdin.write(JSON.stringify({ kind, code, data: records }));
    child.stdin.end();

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("error", (err) => settle({ error: `Failed to start sandbox: ${err.message}` }));

    child.on("close", () => {
      if (!stdout.trim()) {
        const tail = stderr.split("\n").slice(-5).join(" | ");
        settle({ error: `Sandbox produced no response. ${tail}`.trim() });
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { ok: boolean; data?: Record<string, unknown>[]; error?: string };
        if (parsed.ok) settle({ data: parsed.data ?? [] });
        else settle({ error: parsed.error ?? "Sandbox reported failure" });
      } catch {
        settle({ error: "Failed to parse sandbox response" });
      }
    });
  });
}
