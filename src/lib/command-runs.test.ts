import { describe, expect, it } from "vitest";
import type { Message } from "@/state/store";
import { commandRunCounts, commandRunRows, currentCommand, hasPendingApproval } from "./command-runs";

const message = (patch: Partial<Message> & Pick<Message, "id" | "kind">): Message => ({
  role: "bot",
  at: Number(patch.id.replace(/\D/g, "")) || 1,
  ...patch,
});

describe("command run transcript rows", () => {
  it("groups non-adjacent runtime rows by turn and places the group at the final runtime row", () => {
    const messages = [
      message({ id: "1", kind: "activity", turnId: "turn-a", tool: { name: "read a", ok: true } }),
      message({ id: "2", kind: "text", turnId: "turn-a", text: "I found it." }),
      message({ id: "3", kind: "activity", turnId: "turn-a", tool: { name: "test", ok: true } }),
      message({ id: "4", kind: "text", turnId: "turn-a", text: "Done." }),
    ];

    const rows = commandRunRows(messages);
    expect(rows.map((row) => row.kind)).toEqual(["message", "command-run", "message"]);
    expect(rows[1]).toMatchObject({ kind: "command-run", turnId: "turn-a" });
    if (rows[1].kind === "command-run") expect(rows[1].messages.map((entry) => entry.id)).toEqual(["1", "3"]);
  });

  it("leaves legacy, error, and communication activities as ordinary rows", () => {
    const messages = [
      message({ id: "1", kind: "activity", tool: { name: "legacy", ok: true } }),
      message({ id: "2", kind: "activity", turnId: "turn-a", tool: { name: "error: failed", ok: false } }),
      message({ id: "3", kind: "activity", turnId: "turn-a", tool: { name: "Messaged @QA" }, comm: { groupId: "g", withBotId: "b", withName: "QA", withColor: "blue" } }),
    ];
    expect(commandRunRows(messages).every((row) => row.kind === "message")).toBe(true);
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
});
