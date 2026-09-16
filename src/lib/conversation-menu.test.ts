import { describe, expect, it, vi } from "vitest";
import { conversationMenuBindings } from "./conversation-menu";

describe("conversationMenuBindings", () => {
  it("opens the clicked chat without selecting it or opening the native menu", () => {
    const onOpen = vi.fn();
    const event = { clientX: 23, clientY: 42, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    conversationMenuBindings({ botId: "agent", threadId: "older-chat" }, onOpen)
      .onContextMenu(event);
    expect(onOpen).toHaveBeenCalledWith({ botId: "agent", threadId: "older-chat", x: 23, y: 42 });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it.each([{ key: "ContextMenu", shiftKey: false }, { key: "F10", shiftKey: true }])(
    "opens a channel menu with $key at the row center",
    ({ key, shiftKey }) => {
      const onOpen = vi.fn();
      const event = {
        key, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn(),
        currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 40 }) },
      };
      conversationMenuBindings({ groupId: "channel" }, onOpen)
        .onKeyDown(event);
      expect(onOpen).toHaveBeenCalledWith({ groupId: "channel", x: 60, y: 40 });
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(event.stopPropagation).toHaveBeenCalledOnce();
    },
  );

  it.each(["Enter", " ", "F10", "Escape"])("leaves ordinary %s behavior alone", (key) => {
    const onOpen = vi.fn();
    const preventDefault = vi.fn();
    conversationMenuBindings({ groupId: "channel" }, onOpen)
      .onKeyDown({
        key, shiftKey: false, preventDefault, stopPropagation: vi.fn(),
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) },
      });
    expect(onOpen).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
