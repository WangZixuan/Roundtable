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

/** One group per provider turn, placed where that turn's final runtime row
 * occurred. Text may be interleaved between tool events, so adjacency is not
 * a reliable boundary. */
export function commandRunRows(messages: Message[]): TranscriptRow[] {
  const grouped = new Map<string, Message[]>();
  const lastIndex = new Map<string, number>();

  messages.forEach((message, index) => {
    if (!isCommandRunMessage(message)) return;
    const turnId = message.turnId;
    if (!turnId) return;
    const entries = grouped.get(turnId) ?? [];
    entries.push(message);
    grouped.set(turnId, entries);
    lastIndex.set(turnId, index);
  });

  const rows: TranscriptRow[] = [];
  messages.forEach((message, index) => {
    if (!isCommandRunMessage(message)) {
      rows.push({ kind: "message", message });
      return;
    }
    const turnId = message.turnId;
    if (!turnId) return;
    if (lastIndex.get(turnId) === index) {
      const runMessages = grouped.get(turnId);
      if (runMessages) rows.push({ kind: "command-run", turnId, messages: runMessages });
    }
  });
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
