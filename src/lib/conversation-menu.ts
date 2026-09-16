import type { KeyboardEvent, MouseEvent } from "react";

export type ConversationMenuTarget =
  | { botId: string; threadId?: string }
  | { groupId: string };

export type ConversationMenuState = ConversationMenuTarget & { x: number; y: number };

export function conversationMenuBindings(
  target: ConversationMenuTarget,
  onOpen: (menu: ConversationMenuState) => void,
) {
  return {
    onContextMenu: (event: Pick<MouseEvent<HTMLElement>, "clientX" | "clientY" | "preventDefault" | "stopPropagation">) => {
      event.preventDefault();
      event.stopPropagation();
      onOpen({ ...target, x: event.clientX, y: event.clientY });
    },
    onKeyDown: (event: Pick<KeyboardEvent<HTMLElement>, "key" | "shiftKey" | "preventDefault" | "stopPropagation"> & {
      currentTarget: { getBoundingClientRect(): Pick<DOMRect, "left" | "top" | "width" | "height"> };
    }) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      onOpen({ ...target, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    },
  };
}
