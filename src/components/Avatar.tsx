import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  AGENT_COLORS,
  agentAvatarForeground,
  agentInitials,
  type AgentColor,
} from "../../shared/agent-avatar";
import { botAvatarProfile, type BotAvatarCrop, type CoordinatorAvatarCrop } from "../../shared/bot-avatar";
import { orchestrationResourceUrl } from "@/lib/orchestration";

/** Shared size for an agent avatar in expanded navigation and chat headers. */
export const STANDARD_BOT_AVATAR_SIZE = 36;

export type BotAvatarProps = {
  bot: {
    name?: string;
    color: AgentColor;
    avatarUrl?: string | null;
    avatarCrop?: BotAvatarCrop;
  };
  size?: number;
  label?: string;
  className?: string;
  // Transitional presentation hints accepted by existing call sites. Initials
  // deliberately do not animate in response to agent activity.
  state?: string;
  motion?: string;
  motionKey?: number;
  animated?: boolean;
  trackPointer?: boolean;
};

export function AgentInitialsAvatar({
  name,
  color,
  size = 44,
  label,
  className,
}: {
  name: string;
  color: AgentColor;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-label={label ?? `${name || "Unnamed agent"} avatar`}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: AGENT_COLORS[color],
        color: agentAvatarForeground(color),
        fontSize: Math.max(9, size * 0.36),
        letterSpacing: "-0.035em",
      }}
    >
      {agentInitials(name)}
    </span>
  );
}

/** Render a custom image when present and initials for every fallback case. */
export function BotAvatar({ bot, size = 44, label, className }: BotAvatarProps) {
  const profile = botAvatarProfile(bot);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [profile.avatarUrl]);

  if (profile.avatarCrop === "initials" || !profile.avatarUrl || imageFailed) {
    return <AgentInitialsAvatar name={bot.name ?? ""} color={bot.color} size={size} label={label} className={className} />;
  }

  return (
    <img
      src={orchestrationResourceUrl(profile.avatarUrl)}
      alt={label ?? (bot.name ? `${bot.name} avatar` : "Agent avatar")}
      width={size}
      height={size}
      draggable={false}
      onError={() => setImageFailed(true)}
      className={`block shrink-0 bg-raised object-cover ${className ?? ""}`}
      style={{ width: size, height: size, borderRadius: "50%" }}
    />
  );
}

export function CoordinatorAvatar({
  avatarUrl,
  avatarCrop = "circle",
  size = 44,
}: {
  avatarUrl?: string | null;
  avatarCrop?: CoordinatorAvatarCrop;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [avatarUrl]);
  const radius = avatarCrop === "circle" ? "50%" : avatarCrop === "rounded" ? "22%" : "0";
  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={orchestrationResourceUrl(avatarUrl)}
        alt="Coordinator avatar"
        width={size}
        height={size}
        draggable={false}
        onError={() => setImageFailed(true)}
        className="block shrink-0 bg-raised object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <span
      aria-label="Coordinator"
      className="flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/25"
      style={{ width: size, height: size }}
    >
      <Sparkles size={Math.max(14, size * 0.48)} aria-hidden="true" />
    </span>
  );
}

export function InitialsAvatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-raised font-medium text-ink-secondary"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
