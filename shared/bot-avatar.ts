import { z } from "zod";

/** Bots either use the animated mascot or a circular custom image. */
export const BOT_AVATAR_CROPS = ["mascot", "circle"] as const;
export const botAvatarCropSchema = z.enum(BOT_AVATAR_CROPS);
export type BotAvatarCrop = z.infer<typeof botAvatarCropSchema>;

export const COORDINATOR_AVATAR_CROPS = ["circle", "rounded", "square"] as const;
export const coordinatorAvatarCropSchema = z.enum(COORDINATOR_AVATAR_CROPS);
export type CoordinatorAvatarCrop = z.infer<typeof coordinatorAvatarCropSchema>;

/**
 * Custom avatars are deliberately limited to this app's attachment server.
 * Besides making persisted profiles portable across desktop/browser clients,
 * this prevents a bot profile from becoming an external tracking pixel or a
 * script-capable SVG.
 */
export const botAvatarUrlSchema = z
  .string()
  .regex(
    /^\/api\/attachments\/[A-Za-z0-9-]+\.(?:png|jpg|gif|webp)$/,
    "must be a stored PNG, JPEG, GIF, or WebP attachment",
  );

export function botAvatarUrlFromStoredPath(path: string): string | null {
  const name = path.replaceAll("\\", "/").split("/").pop();
  if (!name) return null;
  const url = `/api/attachments/${name}`;
  return botAvatarUrlSchema.safeParse(url).success ? url : null;
}

/** Runtime-safe defaults for untrusted persisted/SSE profile data. */
export interface BotAvatarProfileInput {
  avatarUrl?: unknown;
  avatarCrop?: unknown;
}

export interface BotAvatarProfile {
  avatarUrl?: string;
  avatarCrop: BotAvatarCrop;
}

export function botAvatarProfile(value: BotAvatarProfileInput): BotAvatarProfile {
  const url = botAvatarUrlSchema.safeParse(value.avatarUrl);
  const crop = botAvatarCropSchema.safeParse(value.avatarCrop);
  // Rounded and square were supported before 0.1.34. Preserve those uploaded
  // images while migrating their retired presentation to the one image shape.
  const retiredImageCrop = value.avatarCrop === "rounded" || value.avatarCrop === "square";
  const profile: BotAvatarProfile = {
    avatarCrop: crop.data ?? (url.success && retiredImageCrop ? "circle" : "mascot"),
  };
  if (url.success) profile.avatarUrl = url.data;
  return profile;
}
