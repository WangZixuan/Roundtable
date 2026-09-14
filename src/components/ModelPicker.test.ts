import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Bot, InstanceInfo } from "@/state/store";
import { ModelPicker } from "./ModelPicker";

const store = vi.hoisted(() => ({
  state: { instances: [] as InstanceInfo[] },
  dispatch: vi.fn(),
  refreshInstances: vi.fn(),
}));

vi.mock("@/state/store", () => ({ useStore: () => store }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: vi.fn(react.useState) };
});

const claude: InstanceInfo = {
  instanceId: "claude",
  driverKind: "claude",
  displayName: "Claude",
  snapshot: { state: "available", authenticated: true },
  models: { default: "sonnet", options: [{ id: "sonnet", label: "Sonnet" }] },
};
const copilot: InstanceInfo = {
  instanceId: "copilot",
  driverKind: "copilotAgent",
  displayName: "Github Copilot cli",
  snapshot: { state: "available", authenticated: true },
  models: { default: "gpt-5.3-codex", options: [{ id: "gpt-5.3-codex", label: "GPT-5.3 Codex" }] },
};
const bot: Bot = {
  id: "bot-1",
  threadId: "thread-1",
  name: "Helper",
  title: "",
  description: "",
  notifications: true,
  color: "green",
  unread: false,
  messages: [],
  modelSelection: { instanceId: "claude", model: "sonnet" },
};

function renderPicker(overrides: Partial<Bot> = {}, railId: string | null = null, contained = false) {
  vi.mocked(useState)
    .mockImplementationOnce(() => [true, vi.fn()])
    .mockImplementationOnce(() => [railId, vi.fn()])
    .mockImplementationOnce(() => ["main", vi.fn()]);
  return renderToStaticMarkup(createElement(ModelPicker, { bot: { ...bot, ...overrides }, contained }));
}

describe("ModelPicker provider switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.state.instances = [claude, copilot];
  });

  it.each([false, true])("offers other providers in the picker (contained=%s)", (contained) => {
    const html = renderPicker({}, null, contained);
    expect(html).toContain('aria-label="Claude"');
    expect(html).toContain('aria-label="Github Copilot cli"');
    expect(html).toContain('aria-label="Choose provider and model"');
  });

  it("previews Copilot's catalog without changing the bot", () => {
    const html = renderPicker({}, "copilot");
    expect(html).toContain("GPT-5.3 Codex");
    expect(html).toContain('aria-label="Github Copilot cli" aria-pressed="true"');
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it("keeps other providers accessible when the configured provider disappears", () => {
    store.state.instances = [copilot];
    const html = renderPicker();
    expect(html).toContain("GPT-5.3 Codex");
    expect(html).toContain('aria-label="Github Copilot cli"');
  });

  it("hides unavailable providers and falls back to a ready provider", () => {
    store.state.instances = [claude, { ...copilot, snapshot: { state: "unavailable", reason: "CLI not found" } }];
    const html = renderPicker({}, "copilot");
    expect(html).not.toContain('aria-label="Github Copilot cli"');
    expect(html).not.toContain("GPT-5.3 Codex");
    expect(html).toContain("Sonnet");
  });

  it("hides installed cloud providers that require sign-in", () => {
    store.state.instances = [claude, { ...copilot, snapshot: { state: "available", authenticated: false } }];
    expect(renderPicker()).not.toContain('aria-label="Github Copilot cli"');
  });

  it("shows GPT-6 when returned by the Copilot catalog", () => {
    store.state.instances = [claude, {
      ...copilot,
      models: {
        default: "gpt-6-astra",
        options: [
          ...copilot.models.options,
          { id: "gpt-6-astra", label: "GPT-6 Astra" },
        ],
      },
    }];
    expect(renderPicker({}, "copilot")).toContain("GPT-6 Astra");
  });

  it("blocks switching providers during an active turn", () => {
    const html = renderPicker({ busy: true }, "copilot");
    expect(html).toContain("Stop the current turn before switching providers.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*><span[^>]*><span[^>]*>GPT-5.3 Codex/);
  });

  it("keeps same-provider model selection enabled during an active turn", () => {
    const html = renderPicker({ busy: true });
    expect(html).not.toContain("Stop the current turn before switching providers.");
    expect(html).not.toContain('disabled=""');
  });

  it("points to engine settings when no providers exist", () => {
    store.state.instances = [];
    expect(renderPicker()).toContain("No providers are available.");
  });
});
