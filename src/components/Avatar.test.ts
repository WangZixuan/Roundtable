import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AGENT_COLORS, AGENT_COLOR_NAMES } from "../../shared/agent-avatar";
import { BotAvatar } from "./Avatar";
import { RobotAvatar } from "./RobotAvatar";

describe("default robot avatars", () => {
  it.each(AGENT_COLOR_NAMES)("uses the robot with the saved %s color", (color) => {
    const html = renderToStaticMarkup(createElement(BotAvatar, {
      bot: { name: "Existing bot", color },
      size: 36,
      animated: false,
    }));
    expect(html).toContain(`stop-color="${AGENT_COLORS[color]}"`);
    expect(html).toContain('fill="#142539"');
    expect(html).toContain('aria-label="Existing bot"');
    expect(html).toContain('width="36"');
    expect(html).not.toContain("{{");
    expect(html).not.toContain("<img");
  });

  it("renders the eyes and smile without running effects", () => {
    const html = renderToStaticMarkup(createElement(RobotAvatar, {
      color: "purple",
    }));
    expect(html).toContain('x="86" y="107" width="14" height="23"');
    expect(html).toContain('x="128" y="107" width="14" height="23"');
    expect(html).toContain('d="M103 143Q114 153 125 143"');
    expect(html).not.toContain("<animate");
  });

  it("gives an unnamed standalone robot an accessible label", () => {
    const html = renderToStaticMarkup(createElement(RobotAvatar, { color: "green" }));
    expect(html).toContain('aria-label="Robot avatar"');
  });

  it("keeps a chosen custom image", () => {
    const html = renderToStaticMarkup(createElement(BotAvatar, {
      bot: {
        name: "Custom bot",
        color: "blue",
        avatarUrl: "/api/attachments/custom.png",
        avatarCrop: "circle",
      },
    }));
    expect(html).toContain("<img");
    expect(html).toContain("/api/attachments/custom.png");
    expect(html).not.toContain("<svg");
  });

  it("shows the robot for main's persisted default even with a saved image", () => {
    const html = renderToStaticMarkup(createElement(BotAvatar, {
      bot: {
        color: "green",
        avatarUrl: "/api/attachments/custom.png",
        avatarCrop: "initials",
      },
    }));
    expect(html).toContain('fill="#142539"');
    expect(html).not.toContain("<img");
  });

  it("preserves the upstream className API for custom images and defaults", () => {
    for (const avatarUrl of [undefined, "/api/attachments/custom.png"]) {
      const html = renderToStaticMarkup(createElement(BotAvatar, {
        bot: { name: "Styled bot", color: "blue", avatarUrl, avatarCrop: "circle" },
        className: "profile-avatar",
      }));
      expect(html).toContain("profile-avatar");
    }
  });

  it("ignores legacy animation and motion props", () => {
    const bot = { name: "Static bot", color: "green" } as const;
    const resting = renderToStaticMarkup(createElement(BotAvatar, { bot }));
    const working = renderToStaticMarkup(createElement(BotAvatar, {
      bot,
      state: "working",
      animated: true,
      trackPointer: true,
      motion: "celebrate",
      motionKey: 3,
    }));
    expect(working).toBe(resting);
  });

  it("keeps gradient references unique when robots share a page", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      ...AGENT_COLOR_NAMES.map((color) => createElement(RobotAvatar, { color, key: color })),
    ));
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(AGENT_COLOR_NAMES.length);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
  });
});
