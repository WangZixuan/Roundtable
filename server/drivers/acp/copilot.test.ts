import { EventEmitter } from "node:events";
import { ChildProcess } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureDirs } from "../../config.ts";
import { resetPathCacheForTests } from "../../env-path.ts";
import { removeTempDir } from "../../testing/cleanup.ts";
import { recordEvents } from "../../testing/events.ts";
import {
  classifyCopilotError,
  copilotIsAuthenticated,
  CopilotAgentDriver,
  createCopilotAgentDriver,
  decodeCopilotModelHelp,
  decodeCopilotSessionModels,
  fetchCopilotModels,
  probeCopilotAcpModels,
  STATIC_COPILOT_MODELS,
} from "./copilot.ts";
import type { execCli, spawnCli } from "../../procs.ts";

const FAKE_CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "testing", "fake-acp-cli.ts");

function fakeProcess() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdio: ReturnType<typeof spawnCli>["stdio"] = [stdin, stdout, stderr, null, null];
  return Object.assign(new ChildProcess(), {
    stdin,
    stdout,
    stderr,
    stdio,
  });
}

const sessionModels = {
  models: {
    currentModelId: "gpt-6-astra",
    availableModels: [{ modelId: "gpt-6-astra", name: "GPT-6 Astra" }],
  },
};

describe("GitHub Copilot ACP support", () => {
  const scratchDirs: string[] = [];

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.FAKE_ACP_DUMP;
    delete process.env.COPILOT_GITHUB_TOKEN;
    delete process.env.XAI_API_KEY;
    delete process.env.OMB_EXTRA_PATH;
    resetPathCacheForTests();
    for (const dir of scratchDirs.splice(0)) await removeTempDir(dir);
  });

  it("parses wrapped model choices from copilot --help", () => {
    const catalog = decodeCopilotModelHelp(`
  --model <model>  Set the AI model to use (choices:
                   "claude-sonnet-4.6", "gpt-5.3-codex",
                   "brand-new-model")
  --no-color        Disable color
`);
    expect(catalog).toEqual({
      default: "claude-sonnet-4.6",
      options: [
        { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
        { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
        { id: "brand-new-model", label: "Brand New Model" },
      ],
    });
    expect(decodeCopilotModelHelp("Usage: copilot")).toBeNull();
  });

  it("ignores quoted auto in Copilot 1.0.82 prose so discovery uses the fallback catalog", () => {
    expect(decodeCopilotModelHelp(`
  --model <model>  Set the AI model to use (use 'auto' to
                   let Copilot pick automatically)
  --mouse[=value]  Enable mouse support in alt screen mode
    `)).toBeNull();
  });

  it("decodes only the account-specific models advertised by an ACP session", () => {
    expect(decodeCopilotSessionModels({
      models: {
        currentModelId: "gpt-5.6-sol",
        availableModels: [
          { modelId: "auto", name: "Auto" },
          { modelId: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
          { modelId: "grok-4.6", name: "Grok 4.6" },
        ],
      },
    })).toEqual({
      default: "gpt-5.6-sol",
      options: [
        { id: "auto", label: "Auto" },
        { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
        { id: "grok-4.6", label: "Grok 4.6" },
      ],
    });
  });

  it("probes Copilot's ACP session model catalog", async () => {
    ensureDirs();
    process.env.OMB_EXTRA_PATH = dirname(process.execPath);
    resetPathCacheForTests();
    chmodSync(FAKE_CLI, 0o755);
    const catalog = await probeCopilotAcpModels(FAKE_CLI, {
      ...process.env,
      FAKE_ACP_SESSION_MODELS: "auto|Auto,gpt-5.6-sol|GPT-5.6 Sol,grok-4.6|Grok 4.6",
    });
    expect(catalog).toEqual({
      default: "auto",
      options: [
        { id: "auto", label: "Auto" },
        { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
        { id: "grok-4.6", label: "Grok 4.6" },
      ],
    });
  });

  it("starts the help fallback without waiting for a stalled ACP probe", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
      stderr: PassThrough;
      pid: number;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 12345;

    let helpCallback: ((error: Error | null, stdout: string) => void) | undefined;
    const run = ((_cli, args, _options, callback) => {
      expect(args).toEqual(["--help"]);
      helpCallback = callback;
      return child;
    }) as typeof import("../../procs.ts").execCli;
    const spawnProcess = (() => child) as unknown as typeof import("../../procs.ts").spawnCli;

    const catalogPromise = fetchCopilotModels("copilot", {}, run, spawnProcess);
    expect(helpCallback).toBeTypeOf("function");

    helpCallback!(null, `
  --model <model>  Set the AI model to use (choices: "auto", "gpt-5.6-sol")
  --no-color        Disable color
    `);
    child.emit("error", new Error("ACP handshake stalled"));

    await expect(catalogPromise).resolves.toEqual({
      default: "auto",
      options: [
        { id: "auto", label: "Auto" },
        { id: "gpt-5.6-sol", label: "GPT 5.6 Sol" },
      ],
    });
  });

  it("waits for a live catalog that arrives after the former 15-second deadline", async () => {
    vi.useFakeTimers();
    const child = fakeProcess();
    const spawnProcess: typeof spawnCli = () => child;
    const run: typeof execCli = (_cli, _args, _options, callback) => callback(null, "Usage: copilot");
    const settled = vi.fn();
    const pending = fetchCopilotModels("copilot", {}, run, spawnProcess).then(settled);
    child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(settled).not.toHaveBeenCalled();
    child.stdout.write(`${JSON.stringify({ id: 2, result: sessionModels })}\n`);
    await pending;
    expect(settled).toHaveBeenCalledWith({
      default: "gpt-6-astra",
      options: [{ id: "gpt-6-astra", label: "GPT-6 Astra" }],
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still bounds a stalled model probe at 60 seconds", async () => {
    vi.useFakeTimers();
    const child = fakeProcess();
    const settled = vi.fn();
    const pending = probeCopilotAcpModels("copilot", {}, () => child).then(settled);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toHaveBeenCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains a live catalog after a failed refresh and retries without caching the failure", async () => {
    vi.useFakeTimers();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    let fail = false;
    const spawnProcess = vi.fn<typeof spawnCli>(() => {
      const child = fakeProcess();
      queueMicrotask(() => {
        if (fail) child.emit("error", new Error("Discovery unavailable"));
        else child.stdout.write(`${JSON.stringify({ id: 2, result: sessionModels })}\n`);
      });
      return child;
    });
    const run: typeof execCli = (_cli, _args, _options, callback) => callback(null, "Usage: copilot");
    const driver = createCopilotAgentDriver(run, spawnProcess);
    const instance = await driver.create({
      instanceId: "copilot",
      displayName: "GitHub Copilot",
      enabled: true,
      environment: {},
      config: driver.decodeConfig(undefined),
    });
    try {
      expect(instance.models.default).toBe("gpt-6-astra");
      await instance.refreshModels?.();
      expect(spawnProcess).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_001);
      fail = true;
      await instance.refreshModels?.();
      expect(instance.models.default).toBe("gpt-6-astra");
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("Copilot model discovery failed"));
      fail = false;
      await instance.refreshModels?.();
      expect(spawnProcess).toHaveBeenCalledTimes(3);
      expect(instance.models.default).toBe("gpt-6-astra");
    } finally {
      await instance.dispose();
    }
  });

  it("does not cache the built-in fallback after an initial discovery failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let fail = true;
    const spawnProcess = vi.fn<typeof spawnCli>(() => {
      const child = fakeProcess();
      queueMicrotask(() => {
        if (fail) child.emit("error", new Error("Discovery unavailable"));
        else child.stdout.write(`${JSON.stringify({ id: 2, result: sessionModels })}\n`);
      });
      return child;
    });
    const run: typeof execCli = (_cli, _args, _options, callback) => callback(null, "Usage: copilot");
    const driver = createCopilotAgentDriver(run, spawnProcess);
    const instance = await driver.create({
      instanceId: "copilot",
      displayName: "GitHub Copilot",
      enabled: true,
      environment: {},
      config: driver.decodeConfig(undefined),
    });
    try {
      expect(instance.models).toEqual(STATIC_COPILOT_MODELS);
      fail = false;
      await instance.refreshModels?.();
      expect(spawnProcess).toHaveBeenCalledTimes(2);
      expect(instance.models.default).toBe("gpt-6-astra");
    } finally {
      await instance.dispose();
    }
  });

  it("detects token, BYOK, and stored-login metadata without reading a secret", async () => {
    expect(await copilotIsAuthenticated({ COPILOT_GITHUB_TOKEN: "token" })).toBe(true);
    expect(await copilotIsAuthenticated({ COPILOT_PROVIDER_BASE_URL: "http://localhost:11434" })).toBe(true);
    const root = mkdtempSync(join(tmpdir(), "omb-copilot-auth-"));
    scratchDirs.push(root);
    writeFileSync(
      join(root, "config.json"),
      '// User settings belong in settings.json.\n{"lastLoggedInUser":{"login":"octocat"}}',
    );
    expect(await copilotIsAuthenticated({ COPILOT_HOME: root })).toBe(true);
    expect(await copilotIsAuthenticated({ COPILOT_HOME: join(root, "missing") })).toBe(false);
    const ghRoot = mkdtempSync(join(tmpdir(), "omb-gh-auth-"));
    scratchDirs.push(ghRoot);
    writeFileSync(
      join(ghRoot, "hosts.yml"),
      "github.com:\n    user: octocat\n    oauth_token: gho_testtoken\n    git_protocol: https\n",
    );
    expect(await copilotIsAuthenticated({ GH_CONFIG_DIR: ghRoot })).toBe(true);
  });

  it("accepts an authenticated gh session when token metadata is unavailable", async () => {
    const authed = await copilotIsAuthenticated(
      {},
      (_cli, _args, _opts, cb) => cb(null, "Logged in to github.com as octocat"),
    );
    expect(authed).toBe(true);

    const notAuthed = await copilotIsAuthenticated({}, (_cli, _args, _opts, cb) => cb(new Error("not logged in"), ""));
    expect(notAuthed).toBe(false);
  });

  it("classifies auth, subscription, and quota failures", () => {
    expect(classifyCopilotError(new Error("Authentication required"))).toBe("invalid_credentials");
    expect(classifyCopilotError(new Error("No active Copilot subscription"))).toBe("inactive_subscription");
    expect(classifyCopilotError(new Error("Premium requests limit reached"))).toBe("quota_or_region_restriction");
    expect(classifyCopilotError(new Error("model not found"))).toBeUndefined();
  });

  it("declares setup metadata and backwards-compatible defaults", () => {
    expect(CopilotAgentDriver.driverKind).toBe("copilotAgent");
    expect(CopilotAgentDriver.decodeConfig(undefined)).toEqual({
      cli: "copilot",
      fullAuto: false,
      workspace: undefined,
    });
    expect(CopilotAgentDriver.install?.command?.win32).toContain("GitHub.Copilot");
    expect(CopilotAgentDriver.install?.signInCommand).toBe("copilot login");
  });

  it("runs a model-pinned ACP turn, isolates credentials, and applies fullAuto", async () => {
    ensureDirs();
    process.env.OMB_EXTRA_PATH = dirname(process.execPath);
    resetPathCacheForTests();
    chmodSync(FAKE_CLI, 0o755);
    const scratch = mkdtempSync(join(tmpdir(), "omb-copilot-turn-"));
    scratchDirs.push(scratch);
    const dump = join(scratch, "dump.json");
    process.env.FAKE_ACP_DUMP = dump;
    process.env.COPILOT_GITHUB_TOKEN = "copilot-should-keep";
    process.env.XAI_API_KEY = "xai-should-not-leak";

    const instance = await CopilotAgentDriver.create({
      instanceId: "copilot",
      displayName: "GitHub Copilot",
      environment: { COPILOT_GITHUB_TOKEN: "copilot-should-keep" },
      enabled: true,
      config: { cli: FAKE_CLI, fullAuto: true },
    });
    const recorder = recordEvents(instance.adapter);
    try {
      await instance.adapter.sendTurn({ threadId: "t-copilot", text: "Introduce yourself", model: "gpt-5.3-codex" });
      await recorder.until((event) => event.type === "turn.completed");

      const seen = JSON.parse(readFileSync(dump, "utf8"));
      expect(seen.argv).toEqual(["--allow-all", "--model", "gpt-5.3-codex", "--acp"]);
      expect(seen.env.COPILOT_GITHUB_TOKEN).toBe("copilot-should-keep");
      expect(seen.env.XAI_API_KEY).toBeUndefined();
      expect(JSON.parse(readFileSync(`${dump}.prompt.json`, "utf8"))).toEqual([
        { type: "text", text: "Introduce yourself" },
      ]);
      expect(JSON.parse(readFileSync(`${dump}.mcp.json`, "utf8"))).toEqual([]);
      expect(recorder.events.some((event) => event.type === "turn.completed" && event.ok)).toBe(true);

      expect(JSON.parse(readFileSync(`${dump}.config.json`, "utf8"))).toContainEqual({
        method: "session/set_model",
        params: { sessionId: "fake-acp-session", modelId: "gpt-5.3-codex" },
      });
    } finally {
      recorder.stop();
      await instance.dispose();
    }
  });
});
