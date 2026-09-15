import { describe, expect, it } from "vitest";

import {
  botAvatarProfile,
  botAvatarCropSchema,
  botAvatarUrlFromStoredPath,
  botAvatarUrlSchema,
} from "../shared/bot-avatar.ts";

describe("bot avatar profile schema", () => {
  it("accepts the two supported display shapes", () => {
    for (const crop of ["initials", "circle"]) {
      expect(botAvatarCropSchema.parse(crop)).toBe(crop);
    }
    expect(botAvatarCropSchema.safeParse("rounded").success).toBe(false);
    expect(botAvatarCropSchema.safeParse("square").success).toBe(false);
    expect(botAvatarCropSchema.safeParse("hexagon").success).toBe(false);
  });

  it("migrates retired image shapes to circle without losing the image", () => {
    const avatarUrl = "/api/attachments/123e4567-e89b-12d3-a456-426614174000.webp";
    expect(botAvatarProfile({ avatarUrl, avatarCrop: "rounded" }))
      .toEqual({ avatarUrl, avatarCrop: "circle" });
    expect(botAvatarProfile({ avatarUrl, avatarCrop: "square" }))
      .toEqual({ avatarUrl, avatarCrop: "circle" });
  });

  it("migrates the retired mascot fallback to initials", () => {
    expect(botAvatarProfile({ avatarCrop: "mascot" })).toEqual({ avatarCrop: "initials" });
  });

  it("only accepts app-owned raster attachments", () => {
    expect(botAvatarUrlSchema.parse("/api/attachments/123e4567-e89b-12d3-a456-426614174000.webp"))
      .toContain("/api/attachments/");
    for (const value of [
      "https://tracker.example/avatar.png",
      "/api/attachments/avatar.svg",
      "/api/attachments/../../config.json",
      "data:image/png;base64,abc",
    ]) {
      expect(botAvatarUrlSchema.safeParse(value).success).toBe(false);
    }
  });

  it("turns a saved attachment path into a safe serving URL", () => {
    expect(botAvatarUrlFromStoredPath("/tmp/attachments/abc-123.png"))
      .toBe("/api/attachments/abc-123.png");
    expect(botAvatarUrlFromStoredPath("C:\\data\\attachments\\abc-123.jpg"))
      .toBe("/api/attachments/abc-123.jpg");
    expect(botAvatarUrlFromStoredPath("/tmp/attachments/avatar.svg")).toBeNull();
  });

  it("falls back safely for malformed persisted data", () => {
    expect(botAvatarProfile({ avatarUrl: "https://example.test/pixel.png", avatarCrop: "round" }))
      .toEqual({ avatarCrop: "initials" });
  });
});
