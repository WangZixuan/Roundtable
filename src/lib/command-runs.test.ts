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

  it("leaves legacy, error, and communication activities as ordinary rows", () => {
    const messages = [
      message({ id: "1", kind: "activity", tool: { name: "legacy", ok: true } }),
      message({ id: "2", kind: "activity", turnId: "turn-a", tool: { name: "error: failed", ok: false } }),
      message({ id: "3", kind: "activity", turnId: "turn-a", tool: { name: "Messaged @QA" }, comm: { groupId: "g", withBotId: "b", withName: "QA", withColor: "blue" } }),
    ];
    const rows = commandRunRows(messages);
    expect(rows.some((row) => row.kind === "command-run")).toBe(false);
    expect(rows.flatMap((row) => row.kind === "turn" ? row.rows : [row]).every((row) => row.kind === "message")).toBe(true);
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
