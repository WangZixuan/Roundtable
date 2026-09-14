import { describe, expect, it } from "vitest";

import { availableModelInstances, splitEngineRail } from "./engine-rail";
import type { InstanceInfo } from "@/state/store";

const ready: InstanceInfo = {
  instanceId: "copilot",
  driverKind: "copilotAgent",
  displayName: "Copilot",
  snapshot: { state: "available", authenticated: true },
  models: { default: "gpt-6-astra", options: [{ id: "gpt-6-astra", label: "GPT-6 Astra" }] },
};

describe("availableModelInstances", () => {
  it("keeps a ready provider's returned catalog unchanged", () => {
    expect(availableModelInstances([ready])).toEqual([ready]);
    expect(availableModelInstances([ready])[0]).toBe(ready);
  });

  it("excludes missing CLIs, unsigned cloud providers, and empty catalogs", () => {
    expect(availableModelInstances([
      { ...ready, snapshot: { state: "unavailable" } },
      { ...ready, snapshot: { state: "available", authenticated: false } },
      { ...ready, models: { default: "", options: [] } },
    ])).toEqual([]);
  });

  it("does not require cloud sign-in for local-only providers", () => {
    const local: InstanceInfo = {
      ...ready,
      access: "custom",
      snapshot: { state: "available", authenticated: false },
    };
    expect(availableModelInstances([local])).toEqual([local]);
  });

  it("allows ready providers that do not report authentication", () => {
    const instance: InstanceInfo = { ...ready, snapshot: { state: "available" } };
    expect(availableModelInstances([instance])).toEqual([instance]);
  });
});

describe("splitEngineRail", () => {
  it("keeps Cloud engines above Local engines", () => {
    const { subscription, custom } = splitEngineRail([
      { access: "subscription", instanceId: "claude" },
      { access: "custom", instanceId: "hermes" },
      { instanceId: "grok" },
      { access: "custom", instanceId: "qwen" },
    ]);
    expect(subscription.map((row) => row.instanceId)).toEqual(["claude", "grok"]);
    expect(custom.map((row) => row.instanceId)).toEqual(["hermes", "qwen"]);
  });

  it("hides the second group when nothing is custom-only", () => {
    const rows = [{ instanceId: "claude" }];
    expect(splitEngineRail(rows).custom).toEqual([]);
  });
});
