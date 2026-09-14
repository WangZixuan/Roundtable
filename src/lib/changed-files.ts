import type { Message } from "@/state/store";
import type { CommandRunRow, MessageRow } from "./command-runs";

export type ChangedFileKind = "created" | "modified" | "deleted";

export interface ChangedFile {
  path: string;
  kind: ChangedFileKind;
}

const CHANGE_PATTERNS: Array<{ kind: ChangedFileKind; pattern: RegExp }> = [
  { kind: "created", pattern: /\b(?:created|creating|create|added|adding|add|wrote|writing|write)\s+(?:file\s+)?(?<path>.+)$/i },
  { kind: "modified", pattern: /\b(?:modified|modifying|modify|updated|updating|update|edited|editing|edit)\s+(?:file\s+)?(?<path>.+)$/i },
  { kind: "deleted", pattern: /\b(?:deleted|deleting|delete|removed|removing|remove)\s+(?:file\s+)?(?<path>.+)$/i },
];

function cleanPath(value: string): string {
  return value
    .trim()
    .replace(/^["'`]+|["'`.,;:]+$/g, "")
    .trim();
}

function looksLikePath(value: string): boolean {
  return /^[A-Za-z]:\\/.test(value) || /[\\/]/.test(value) || /\.[A-Za-z0-9]{1,12}$/.test(value);
}

export function changedFileFromToolName(name: string): ChangedFile | null {
  const title = name.replace(/^auto-approved\s+\w+:\s*/i, "").trim();
  for (const { kind, pattern } of CHANGE_PATTERNS) {
    const path = cleanPath(pattern.exec(title)?.groups?.path ?? "");
    if (path && looksLikePath(path)) return { kind, path };
  }
  return null;
}

function mergeKind(previous: ChangedFileKind | undefined, next: ChangedFileKind): ChangedFileKind {
  if (next === "deleted" || previous === "deleted") return "deleted";
  if (next === "created" || previous === "created") return "created";
  return "modified";
}

export function changedFilesFromMessages(messages: Message[]): ChangedFile[] {
  const byPath = new Map<string, ChangedFileKind>();
  for (const message of messages) {
    if (message.kind !== "activity" || !message.tool || message.tool.ok === false) continue;
    const change = changedFileFromToolName(message.tool.name);
    if (!change) continue;
    byPath.set(change.path, mergeKind(byPath.get(change.path), change.kind));
  }
  return [...byPath.entries()].map(([path, kind]) => ({ path, kind }));
}

export function changedFilesFromTurnRows(rows: Array<CommandRunRow | MessageRow>): ChangedFile[] {
  return changedFilesFromMessages(rows.flatMap((row) => row.kind === "command-run" ? row.messages : [row.message]));
}
