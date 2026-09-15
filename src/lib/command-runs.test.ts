import { describe, expect, it } from "vitest";
import type { Message } from "@/state/store";
import { commandRunCounts, commandRunRows, currentCommand, hasPendingApproval, isLiveCommandRun } from "./command-runs";

const message = (patch: Partial<Message> & Pick<Message, "id" | "kind">): Message => ({
  role: "bot",
  at: Number(patch.id.replace(/\D/g, "")) || 1,
  ...patch,
});

describe("command run transcript rows", () => {
  it("groups all bot sections from one turn into a single transcript block", () => {
    const messages = [
      message({ id: "1", kind: "activity", turnId: "turn-a", tool: { name: "read a", ok: true } }),
      message({ id: "2", kind: "text", turnId: "turn-a", text: "I found it." }),
      message({ id: "3", kind: "activity", turnId: "turn-a", tool: { name: "test", ok: true } }),
      message({ id: "4", kind: "text", turnId: "turn-a", text: "Done." }),
    ];

    const rows = commandRunRows(messages);
    expect(rows.map((row) => row.kind)).toEqual(["turn"]);
    if (rows[0].kind === "turn") {
      expect(rows[0].rows.map((row) => row.kind)).toEqual(["command-run", "message", "command-run", "message"]);
    }
  });

  it("groups settled legacy activities while leaving live, error, and communication rows unchanged", () => {
    const messages = [
      message({ id: "1", kind: "activity", tool: { name: "legacy", ok: true } }),
      message({ id: "2", kind: "activity", tool: { name: "legacy two", ok: true } }),
      message({ id: "3", kind: "activity", tool: { name: "still running" } }),
      message({ id: "4", kind: "activity", turnId: "turn-a", tool: { name: "error: failed", ok: false } }),
      message({ id: "5", kind: "activity", turnId: "turn-a", tool: { name: "Messaged @QA" }, comm: { groupId: "g", withBotId: "b", withName: "QA", withColor: "blue" } }),
    ];
    const rows = commandRunRows(messages);
    const flattened = rows.flatMap((row) => row.kind === "turn" ? row.rows : [row]);
    expect(flattened[0]).toMatchObject({
      kind: "command-run",
      messages: [{ id: "1" }, { id: "2" }],
    });
    expect(flattened.slice(1).every((row) => row.kind === "message")).toBe(true);
  });

  it("treats legacy bot output between user messages as one backend turn", () => {
    const messages = [
      message({ id: "1", kind: "text", role: "user", text: "Start" }),
      message({ id: "2", kind: "text", text: "Checking." }),
      message({ id: "3", kind: "activity", tool: { name: "read", ok: true } }),
      message({ id: "4", kind: "text", text: "Done." }),
      message({ id: "5", kind: "text", role: "user", text: "Next" }),
      message({ id: "6", kind: "text", text: "Second turn." }),
    ];

    const rows = commandRunRows(messages);
    expect(rows.map((row) => row.kind)).toEqual(["message", "turn", "message", "turn"]);
    expect(rows[1]).toMatchObject({
      kind: "turn",
      rows: [
        { kind: "message", message: { id: "2" } },
        { kind: "command-run", messages: [{ id: "3" }] },
        { kind: "message", message: { id: "4" } },
      ],
    });
  });

  it("counts actions and approvals and exposes only an unfinished current command", () => {
    const messages = [
      message({ id: "1", kind: "activity", turnId: "turn-a", tool: { name: "read", ok: true } }),
      message({ id: "2", kind: "options", turnId: "turn-a", card: { title: "Approval needed", subtitle: "write", options: [], requestId: "r", tool: "Write", answered: "allow" } }),
      message({ id: "3", kind: "activity", turnId: "turn-a", tool: { name: "test" } }),
    ];
    expect(commandRunCounts(messages)).toEqual({ actions: 2, approvals: 1, failed: false });
    expect(currentCommand(messages)?.id).toBe("3");
    expect(hasPendingApproval(messages)).toBe(false);
  });

  it("recognizes an unresolved approval without treating a user denial as a command failure", () => {
    const pending = message({ id: "1", kind: "options", turnId: "turn-a", card: { title: "Approval needed", subtitle: "remove", options: [], requestId: "r", tool: "Bash" } });
    expect(hasPendingApproval([pending])).toBe(true);
    expect(commandRunCounts([{ ...pending, card: { ...pending.card!, answered: "deny" } }]).failed).toBe(false);
  });

  it("only marks the latest unresolved command sequence as live", () => {
    const messages = [
      message({ id: "1", kind: "activity", turnId: "turn-a", tool: { name: "old command" } }),
      message({ id: "2", kind: "text", turnId: "turn-a", text: "Continuing." }),
      message({ id: "3", kind: "activity", turnId: "turn-a", tool: { name: "new command" } }),
    ];
    const rows = commandRunRows(messages);
    const nestedCommandRows = rows.flatMap((row) => row.kind === "turn" ? row.rows.filter((nested) => nested.kind === "command-run") : []);
    expect(isLiveCommandRun(rows, nestedCommandRows[0], "turn-a")).toBe(false);
    expect(isLiveCommandRun(rows, nestedCommandRows[1], "turn-a")).toBe(true);
  });
});
