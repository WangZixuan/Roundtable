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

export interface TurnRow {
  kind: "turn";
  turnId: string;
  rows: Array<CommandRunRow | MessageRow>;
}

export type TranscriptRow = TurnRow | CommandRunRow | MessageRow;

export interface CommandRunCounts {
  actions: number;
  approvals: number;
  inProgress: number;
  failed: number;
  completed: number;
}

/** Runtime rows that become one compact command history after their turn.
 * Errors keep their dedicated treatment, and bot-to-bot communication keeps
 * its navigation chip. */
export function isCommandRunMessage(message: Message): boolean {
  if (message.comm) return false;
  if (message.kind === "activity" && message.tool) {
    return !message.tool.name.startsWith("error:");
  }
  return message.kind === "options" && Boolean(message.card?.requestId && message.card.tool);
}

/** Runtime rows form compact consecutive groups. Assistant text is a hard
 * boundary, even when later tool calls belong to the same backend turn. */
export function commandRunRows(messages: Message[]): TranscriptRow[] {
  const rows: Array<CommandRunRow | MessageRow> = [];
  for (const message of messages) {
    if (isCommandRunMessage(message)) {
      const previous = rows.at(-1);
      const runId = message.turnId ?? (
        previous?.kind === "command-run" && previous.turnId.startsWith("legacy:")
          ? previous.turnId
          : `legacy:${message.id}`
      );
      if (previous?.kind === "command-run" && previous.turnId === runId) {
        previous.messages.push(message);
      } else {
        rows.push({ kind: "command-run", turnId: runId, messages: [message] });
      }
    } else {
      rows.push({ kind: "message", message });
    }
  }

  const grouped: TranscriptRow[] = [];
  let legacyTurnId: string | undefined;
  for (const row of rows) {
    const explicitTurnId = row.kind === "command-run"
      ? row.turnId.startsWith("legacy:") ? undefined : row.turnId
      : row.message.turnId;
    const legacyBotRow = !explicitTurnId && (
      row.kind === "command-run" ||
      (row.message.role === "bot" && !row.message.comm)
    );
    if (explicitTurnId) legacyTurnId = undefined;
    else if (legacyBotRow && !legacyTurnId) {
      const messageId = row.kind === "command-run" ? row.messages[0].id : row.message.id;
      legacyTurnId = `legacy-turn:${messageId}`;
    } else if (!legacyBotRow) {
      legacyTurnId = undefined;
    }
    const turnId = explicitTurnId ?? (legacyBotRow ? legacyTurnId : undefined);
    const previous = grouped.at(-1);
    if (turnId && row.kind === "message" && row.message.role === "bot") {
      if (previous?.kind === "turn" && previous.turnId === turnId) {
        previous.rows.push(row);
      } else {
        grouped.push({ kind: "turn", turnId, rows: [row] });
      }
    } else if (turnId && row.kind === "command-run") {
      if (previous?.kind === "turn" && previous.turnId === turnId) {
        previous.rows.push(row);
      } else {
        grouped.push({ kind: "turn", turnId, rows: [row] });
      }
    } else {
      grouped.push(row);
    }
  }
  return grouped;
}

export function commandRunCounts(messages: Message[]): CommandRunCounts {
  let actions = 0;
  let approvals = 0;
  let inProgress = 0;
  let failed = 0;
  let completed = 0;
  for (const message of messages) {
    if (message.kind === "options" && message.card?.tool) approvals += 1;
    if (message.kind === "activity" && message.tool) {
      if (/^auto-approved\b/i.test(message.tool.name)) approvals += 1;
      else {
        actions += 1;
        if (message.tool.ok === undefined) inProgress += 1;
        else if (message.tool.ok === false) failed += 1;
        else completed += 1;
      }
    }
  }
  return { actions, approvals, inProgress, failed, completed };
}

export function commandRuns(rows: TranscriptRow[]): CommandRunRow[] {
  return rows.flatMap((candidate) =>
    candidate.kind === "turn"
      ? candidate.rows.filter((nested): nested is CommandRunRow => nested.kind === "command-run")
      : candidate.kind === "command-run"
        ? [candidate]
        : [],
  );
}

export function currentCommand(messages: Message[]): Message | undefined {
  return [...messages].reverse().find(
    (message) => message.kind === "activity" && message.tool && message.tool.ok === undefined,
  );
}

export function isLiveCommandRun(
  rows: TranscriptRow[],
  row: CommandRunRow,
  liveTurnId: string | undefined,
): boolean {
  if (!liveTurnId || row.turnId !== liveTurnId || !currentCommand(row.messages)) return false;
  const latest = [...commandRuns(rows)].reverse().find(
    (candidate) => candidate.turnId === liveTurnId && currentCommand(candidate.messages),
  );
  return latest === row;
}

export function hasPendingApproval(messages: Message[]): boolean {
  return messages.some(
    (message) => message.kind === "options" && message.card?.tool && !message.card.answered && !message.card.dismissed,
  );
}
