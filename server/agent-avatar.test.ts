import { describe, expect, it } from "vitest";

import { AGENT_COLOR_NAMES, agentColorForName, agentColorIndex, agentInitials } from "../shared/agent-avatar.ts";

describe("agent avatars", () => {
  it("derives compact initials from common name shapes", () => {
    expect(agentInitials("Minliang Zhou")).toBe("MZ");
    expect(agentInitials("Codex")).toBe("CO");
    expect(agentInitials("周明亮")).toBe("周明");
    expect(agentInitials("  Ada   Lovelace  ")).toBe("AL");
    expect(agentInitials("")).toBe("?");
  });

  it("maps normalized names deterministically into the ten-color palette", () => {
    const index = agentColorIndex("Minliang Zhou");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(10);
    expect(agentColorIndex("  MINLIANG   ZHOU ")).toBe(index);
    expect(agentColorForName("Minliang Zhou")).toBe(AGENT_COLOR_NAMES[index]);
  });
});
