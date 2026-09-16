import { describe, expect, it } from "vitest";
import { matchesChatFilter, type ChatFilter } from "./chat-filter";

const chats = [
  { kind: "channel", unread: false },
  { kind: "channel", unread: true },
  { kind: "direct", unread: false },
  { kind: "direct", unread: true },
] as const;

describe("matchesChatFilter", () => {
  it.each<{ filter: ChatFilter; indices: number[] }>([
    { filter: "all", indices: [0, 1, 2, 3] },
    { filter: "channels", indices: [0, 1] },
    { filter: "direct", indices: [2, 3] },
    { filter: "unread", indices: [1, 3] },
  ])("selects the expected chats for $filter", ({ filter, indices }) => {
    expect(chats.flatMap((chat, index) => matchesChatFilter(chat, filter) ? [index] : []))
      .toEqual(indices);
  });
});
