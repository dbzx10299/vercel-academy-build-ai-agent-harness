import "dotenv/config";
import { ToolLoopAgent, stepCountIs } from "ai";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { buildSystemPrompt } from "./src/system";
import type { Sandbox } from "./src/sandbox";
import { createReadTool, createGrepTool, createBashTool } from "./src/tools";

const workingDir = resolve(process.argv[2] || process.cwd());

const SAFE_PREFIXES = [
  "ls", "cat", "echo", "pwd", "which", "find",
  "head", "tail", "wc", "git log", "git status", "git diff",
];

type ApprovalConfig =
  | { mode: "interactive" }
  | { mode: "background" }
  | { mode: "delegated"; trust: string[] };

function createApproval(config: ApprovalConfig) {
  return ({ command }: { command: string }) => {
    if (config.mode === "background") return false;

    if (config.mode === "delegated") {
      return !config.trust.some((p) => command.trim().startsWith(p));
    }

    return !SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
  };
}

// Temporary inline backend; moves into its own implementation next lesson.
const sandbox: Sandbox = {
  type: "local",
  workingDirectory: workingDir,
  readFile: async (path) => readFileSync(resolve(workingDir, path), "utf-8"),
  exec: async (command) => {
    try {
      const stdout = execSync(command, {
        cwd: workingDir,
        encoding: "utf-8",
        timeout: 30_000,
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return {
        stdout: e.stdout || e.stderr || e.message || "",
        exitCode: e.status ?? 1,
      };
    }
  },
  stop: async () => {},
};

const read = createReadTool(sandbox);
const grep = createGrepTool(sandbox);
const bash = createBashTool(sandbox, createApproval({ mode: "interactive" }));

const cwd = resolve(process.argv[2] || process.cwd());

const agentsPath = join(cwd, "AGENTS.md");
const projectContext = existsSync(agentsPath)
  ? readFileSync(agentsPath, "utf-8")
  : undefined;

const tools = { read, grep, bash };

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: buildSystemPrompt({
    workingDirectory: cwd,
    sandboxType: "local",
    toolNames: Object.keys(tools),
    projectContext,
  }),
  tools,
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(" ") || "Hello!";
const { text, steps } = await agent.generate({ prompt });
console.log(text);
console.log(`\n(${steps.length} steps)`);
