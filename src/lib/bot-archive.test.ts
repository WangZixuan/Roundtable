import { describe, expect, it, vi } from "vitest";
import { initialState, type Bot } from "@/state/store";
import { setBotArchived } from "./bot-archive";

const bot: Bot = {
  id: "agent", threadId: "chat", name: "Agent", title: "", description: "",
  notifications: true, color: "blue", unread: false, messages: [],
  modelSelection: { instanceId: "codex", model: "default" },
};

describe("setBotArchived", () => {
  it("persists archiving and selects another visible agent", async () => {
    const state = { ...initialState, bots: [bot, { ...bot, id: "next" }], selectedId: bot.id };
    const archived = { ...bot, hidden: true };
    const patch = vi.fn().mockResolvedValue(archived);
    const dispatch = vi.fn();
    await setBotArchived(bot.id, true, () => state, dispatch, patch);
    expect(patch).toHaveBeenCalledWith(bot.id, true);
    expect(dispatch.mock.calls).toEqual([
      [{ type: "botPatched", bot: archived }],
      [{ type: "select", id: "next" }],
    ]);
  });

  it("preserves a selection changed while the archive request was pending", async () => {
    let state = { ...initialState, bots: [bot, { ...bot, id: "next" }], selectedId: bot.id };
    const patch = async () => {
      state = { ...state, selectedId: "channel" };
      return { ...bot, hidden: true };
    };
    const dispatch = vi.fn();
    await setBotArchived(bot.id, true, () => state, dispatch, patch);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "botPatched", bot: { ...bot, hidden: true } });
  });

  it("restores the agent and selects its existing conversation", async () => {
    const state = { ...initialState, bots: [{ ...bot, hidden: true }] };
    const dispatch = vi.fn();
    const patch = vi.fn().mockResolvedValue({ ...bot, hidden: false });
    await setBotArchived(bot.id, false, () => state, dispatch, patch);
    expect(patch).toHaveBeenCalledWith(bot.id, false);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "select", id: bot.id });
  });

  it("rejects archiving the last visible agent before making a request", async () => {
    const state = { ...initialState, bots: [bot, { ...bot, id: "hidden", hidden: true }] };
    const patch = vi.fn();
    const dispatch = vi.fn();
    await expect(setBotArchived(bot.id, true, () => state, dispatch, patch))
      .rejects.toThrow("Keep at least one active bot");
    expect(patch).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("propagates persistence failures without success-shaped state changes", async () => {
    const state = { ...initialState, bots: [bot, { ...bot, id: "next" }] };
    const patch = vi.fn().mockRejectedValue(new Error("Offline"));
    const dispatch = vi.fn();
    await expect(setBotArchived(bot.id, true, () => state, dispatch, patch)).rejects.toThrow("Offline");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
