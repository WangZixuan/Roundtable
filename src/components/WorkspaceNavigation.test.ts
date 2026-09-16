import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, type Group } from "@/state/store";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

let state = initialState;

vi.mock("@/state/store", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/state/store")>(),
  useStore: () => ({ state, dispatch: vi.fn() }),
}));

vi.mock("./DesktopCapabilities", () => ({
  useDesktopCapabilities: () => ({ capabilities: { host: { label: "Browser" } } }),
}));

function renderChannel(overrides: Partial<Group> = {}) {
  const group: Group = {
    id: "channel",
    threadId: "thread",
    name: "Engineering",
    memberIds: [],
    bulletin: "",
    unread: true,
    createdAt: 1,
    messages: [{ id: "message", role: "bot", kind: "text", at: 2, text: "Ready for review" }],
    ...overrides,
  };
  state = { ...initialState, groups: [group], selectedId: group.id };
  const markup = renderToStaticMarkup(createElement(WorkspaceNavigation, {
    open: true,
    onClose: vi.fn(),
  }));
  const row = markup.match(/<button\b[^>]*aria-current="page"[\s\S]*?<\/button>/)?.[0];
  expect(row).toBeDefined();
  return row!;
}

describe("channel rows in Chats", () => {
  beforeEach(() => { state = initialState; });

  it("shows the message as the title and the prefixed channel name as the subtitle", () => {
    const row = renderChannel();
    expect(row).toContain('class="truncate text-[13px] font-medium text-ink">Ready for review</span>');
    expect(row).toContain('class="block truncate text-[12px] text-ink-secondary"># Engineering</span>');
  });

  it("removes the channel avatar while preserving selection and unread state", () => {
    const row = renderChannel();
    expect(row).not.toContain("<svg");
    expect(row).not.toContain("size-9");
    expect(row).toContain('aria-current="page"');
    expect(row).toContain("size-2 shrink-0 rounded-full bg-accent");
  });

  it("keeps the empty-channel fallback as the title", () => {
    expect(renderChannel({ messages: [] })).toContain(
      'class="truncate text-[13px] font-medium text-ink">No messages yet</span>',
    );
  });
});
