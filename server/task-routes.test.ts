import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { removeTempDir, waitForExit } from "./testing/cleanup.ts";

const replySchema = z.object({
  type: z.literal("roundtable:response"),
  id: z.string(),
  response: z.object({ status: z.number(), body: z.instanceof(Uint8Array) }),
});
const taskSchema = z.object({
  threadId: z.string(),
  title: z.string(),
  checkpoint: z.object({ summary: z.string(), nextStep: z.string(), status: z.string() }).optional(),
});
const botSchema = z.object({
  id: z.string(), threadId: z.string(), tasks: z.array(taskSchema),
  messages: z.array(z.unknown()).optional(),
});
const bodySchema = z.object({
  error: z.string().optional(),
  transport: z.string().optional(),
  bot: botSchema.optional(),
  bots: z.array(botSchema).optional(),
  task: taskSchema.optional(),
  hasMore: z.boolean().optional(),
});
type Reply = { status: number; body: z.infer<typeof bodySchema> };
let child: ChildProcess;
let home: string;
let sequence = 0;
let stderr = "";
const pending = new Map<string, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();

function request(method: string, path: string, body?: Record<string, string>): Promise<Reply> {
  const id = String(++sequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`IPC request timed out: ${method} ${path}\n${stderr}`));
    }, 15_000);
    pending.set(id, {
      resolve: (reply) => { clearTimeout(timer); resolve(reply); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    child.send({
      type: "roundtable:request", id,
      request: { method, path, body: body === undefined ? undefined : JSON.stringify(body) },
    }, (error) => {
      if (!error) return;
      pending.get(id)?.reject(error);
      pending.delete(id);
    });
  });
}

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), "roundtable-task-ipc-"));
  mkdirSync(join(home, ".Roundtable"));
  writeFileSync(join(home, ".Roundtable", "config.json"), JSON.stringify({
    instances: { ghost: { driver: "not-a-real-driver", displayName: "Ghost" } },
  }));
  const serverDir = dirname(fileURLToPath(import.meta.url));
  child = spawn(process.execPath, ["--experimental-transform-types", join(serverDir, "testing", "ipc-host.ts")], {
    cwd: join(serverDir, ".."),
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      HOME: home, USERPROFILE: home, OMB_WEBHOOK_PORT: "0",
    },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    serialization: "advanced",
  });
  child.stderr!.on("data", (data) => { stderr += data; });
  child.on("message", (message) => {
    const parsed = replySchema.safeParse(message);
    if (!parsed.success) return; // The host also emits readiness and event frames.
    const { id, response } = parsed.data;
    const waiter = pending.get(id);
    if (!waiter) return;
    pending.delete(id);
    try {
      waiter.resolve({
        status: response.status,
        body: bodySchema.parse(JSON.parse(new TextDecoder().decode(response.body))),
      });
    } catch (error) {
      waiter.reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
  const fail = (error: Error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };
  child.on("error", fail);
  child.on("exit", (code) => fail(new Error(`IPC host exited ${code}\n${stderr}`)));
  const health = await request("GET", "/api/health");
  expect(health.status).toBe(200);
  expect(health.body.transport).toBe("ipc");
});

afterAll(async () => {
  await waitForExit(child, { signal: "SIGTERM" });
  await removeTempDir(home);
});

describe("chat task routes over desktop IPC", () => {
  it("deletes an active chat and returns the surviving conversation for the renderer", async () => {
    const original = (await request("POST", "/api/bots")).body.bot!;
    const created = await request("POST", `/api/bots/${original.id}/tasks`, { title: "Disposable" });
    expect(created.status).toBe(201);
    const threadId = created.body.task!.threadId;
    const deleted = await request("DELETE", `/api/bots/${original.id}/tasks/${threadId}?messages=10`);
    expect(deleted.status, deleted.body.error).toBe(200);
    expect(deleted.body.bot).toMatchObject({
      id: original.id, threadId: original.threadId,
      tasks: [{ threadId: original.threadId }], messages: expect.any(Array),
    });
    expect(deleted.body.hasMore).toBe(false);
    const reopened = await request("POST", `/api/bots/${original.id}/tasks/${threadId}`);
    expect(reopened.status).toBe(404);
  });

  it("keeps rename, checkpoint and switch routes separate from chat deletion", async () => {
    const original = (await request("POST", "/api/bots")).body.bot!;
    const created = await request("POST", `/api/bots/${original.id}/tasks`, { title: "Second" });
    const path = `/api/bots/${original.id}/tasks/${created.body.task!.threadId}`;
    const renamed = await request("PATCH", path, { title: "Renamed" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.task?.title).toBe("Renamed");
    const checkpoint = await request("PATCH", `${path}/checkpoint`, {
      summary: "Saved", nextStep: "Continue", status: "active",
    });
    expect(checkpoint.status).toBe(200);
    expect(checkpoint.body.task?.checkpoint).toMatchObject({ summary: "Saved", nextStep: "Continue" });
    expect((await request("DELETE", `${path}/checkpoint`)).status).toBe(404);
    const switched = await request("POST", path);
    expect(switched.status).toBe(200);
    expect(switched.body.bot?.tasks).toHaveLength(2);
    const deleted = await request("DELETE", `/api/bots/${original.id}/tasks/${original.threadId}?messages=10`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.bot?.threadId).toBe(created.body.task!.threadId);
    expect(deleted.body.bot?.tasks).toHaveLength(1);
    const last = await request("DELETE", path);
    expect(last.status).toBe(200);
    expect(last.body.bot).toMatchObject({ id: original.id, tasks: [], threadId: "", messages: [] });
    expect(last.body.hasMore).toBe(false);
    const listed = await request("GET", "/api/bots?messages=0");
    expect(listed.body.bots?.find((bot) => bot.id === original.id)).toMatchObject({
      tasks: [], threadId: "", messages: [],
    });
    expect((await request("DELETE", path)).status).toBe(404);
    const send = await request("POST", `/api/bots/${original.id}/messages`, { text: "No active chat" });
    expect(send.status).toBe(409);
    expect(send.body.error).toBe("Create a chat before sending a message");
    const fresh = await request("POST", `/api/bots/${original.id}/tasks`, { title: "Fresh chat" });
    expect(fresh.status).toBe(201);
    expect(fresh.body.bot?.tasks).toHaveLength(1);
    expect(fresh.body.bot?.threadId).not.toBe(created.body.task!.threadId);
    expect(fresh.body.bot?.messages).toEqual([]);
  });
});
