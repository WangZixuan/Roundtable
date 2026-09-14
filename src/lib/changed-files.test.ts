import { describe, expect, it } from "vitest";
import type { Message } from "@/state/store";
import { changedFileFromToolName, changedFilesFromMessages } from "./changed-files";

const activity = (id: string, name: string, ok: boolean | undefined = true): Message => ({
  id,
  at: Number(id),
  role: "bot",
  kind: "activity",
  tool: { name, ok },
});

describe("changed file extraction", () => {
  it("extracts explicit created, modified, and deleted file titles", () => {
    expect(changedFileFromToolName("Created D:\\work\\Roundtable\\src\\New.tsx")).toEqual({
      kind: "created",
      path: "D:\\work\\Roundtable\\src\\New.tsx",
    });
    expect(changedFileFromToolName("Update file src\\components\\ChatView.tsx")).toEqual({
      kind: "modified",
      path: "src\\components\\ChatView.tsx",
    });
    expect(changedFileFromToolName("Deleted file 'src\\old.ts'")).toEqual({
      kind: "deleted",
      path: "src\\old.ts",
    });
  });

  it("ignores generic edit tools and read-only tool titles", () => {
    expect(changedFileFromToolName("apply_patch")).toBeNull();
    expect(changedFileFromToolName("auto-approved edit: Update file")).toBeNull();
    expect(changedFileFromToolName("Viewing D:\\work\\Roundtable\\src\\components\\ChatView.tsx")).toBeNull();
    expect(changedFileFromToolName("Searching for 'Changed files'")).toBeNull();
  });

  it("deduplicates paths and preserves meaningful change type", () => {
    expect(changedFilesFromMessages([
      activity("1", "Created src\\New.tsx"),
      activity("2", "Modified src\\New.tsx"),
      activity("3", "Deleted src\\Old.tsx"),
      activity("4", "Modified src\\Skipped.tsx", false),
    ])).toEqual([
      { kind: "created", path: "src\\New.tsx" },
      { kind: "deleted", path: "src\\Old.tsx" },
    ]);
  });
});
