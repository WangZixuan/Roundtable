import type { Message } from "@/state/store";

export interface CommandRunRow {
  kind: "command-run";
  turnId: string;
  messages: Message[];
}

export interface MessageRow {
  kind: "message";
  message: Message;
}

export type TranscriptRow = CommandRunRow | MessageRow;

export interface CommandRunCounts {
  actions: number;
  approvals: number;
  failed: boolean;
}

/** Runtime rows that become one compact command history after their turn.
 * Errors keep their dedicated treatment, and bot-to-bot communication keeps
 * its navigation chip. Old persisted rows without a turnId remain unchanged. */
export function isCommandRunMessage(message: Message): boolean {
  if (!message.turnId || message.comm) return false;
  if (message.kind === "activity" && message.tool) {
    return !message.tool.name.startsWith("error:");
  }
  return message.kind === "options" && Boolean(message.card?.requestId && message.card.tool);
}

/** Consecutive runtime rows share a compact group. Assistant text is a
 * meaningful transcript boundary, so each command sequence remains beside
 * the assistant message that introduced it rather than being merged across
 * an entire provider turn. */
export function commandRunRows(messages: Message[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  for (const message of messages) {
    if (isCommandRunMessage(message) && message.turnId) {
      const previous = rows.at(-1);
      if (previous?.kind === "command-run" && previous.turnId === message.turnId) {
        previous.messages.push(message);
      } else {
        rows.push({ kind: "command-run", turnId: message.turnId, messages: [message] });
      }
    } else {
      rows.push({ kind: "message", message });
    }
  }
  return rows;
}

export function commandRunCounts(messages: Message[]): CommandRunCounts {
  let actions = 0;
  let approvals = 0;
  let failed = false;
  for (const message of messages) {
    if (message.kind === "options" && message.card?.tool) approvals += 1;
    if (message.kind === "activity" && message.tool) {
      if (/^auto-approved\b/i.test(message.tool.name)) approvals += 1;
      else actions += 1;
      if (message.tool.ok === false) failed = true;
    }
    if (message.card?.answered === "unavailable") failed = true;
  }
  return { actions, approvals, failed };
}

export function currentCommand(messages: Message[]): Message | undefined {
  return [...messages].reverse().find(
    (message) => message.kind === "activity" && message.tool && message.tool.ok === undefined,
  );
}

export function hasPendingApproval(messages: Message[]): boolean {
  return messages.some(
    (message) => message.kind === "options" && message.card?.tool && !message.card.answered && !message.card.dismissed,
  );
}
