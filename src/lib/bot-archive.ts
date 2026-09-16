import type { Dispatch } from "react";
import { api, type Action, type AppState, type Bot } from "@/state/store";

type ArchiveState = Pick<AppState, "bots" | "selectedId">;

async function patchArchived(botId: string, hidden: boolean): Promise<Bot> {
  const response = await api(`/api/bots/${botId}`, {
    method: "PATCH",
    body: JSON.stringify({ hidden }),
  });
  return response.bot;
}

export async function setBotArchived(
  botId: string,
  hidden: boolean,
  getState: () => ArchiveState,
  dispatch: Dispatch<Action>,
  patch: (botId: string, hidden: boolean) => Promise<Bot> = patchArchived,
): Promise<void> {
  if (hidden && getState().bots.filter((bot) => !bot.hidden).length <= 1) {
    throw new Error("Keep at least one active bot");
  }
  const bot = await patch(botId, hidden);
  dispatch({ type: "botPatched", bot });
  const state = getState();
  if (!hidden) dispatch({ type: "select", id: botId });
  else if (state.selectedId === botId) {
    const next = state.bots.find((candidate) => !candidate.hidden && candidate.id !== botId);
    if (next) dispatch({ type: "select", id: next.id });
  }
}
