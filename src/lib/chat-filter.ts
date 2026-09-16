export type ChatFilter = "all" | "channels" | "direct" | "unread";

export function matchesChatFilter(
  chat: { kind: "channel" | "direct"; unread: boolean },
  filter: ChatFilter,
): boolean {
  switch (filter) {
    case "all": return true;
    case "channels": return chat.kind === "channel";
    case "direct": return chat.kind === "direct";
    case "unread": return chat.unread;
  }
}
