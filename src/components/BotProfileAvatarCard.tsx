import { useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";

import { type Bot } from "@/state/store";
import { imageAttachmentFromFile } from "@/lib/composer-attachments";
import { cn } from "@/lib/cn";
import {
  AGENT_COLORS,
  AGENT_COLOR_NAMES,
  agentColorForName,
} from "../../shared/agent-avatar";
import { botAvatarUrlFromStoredPath } from "../../shared/bot-avatar";
import { BotAvatar } from "./Avatar";

type AvatarPatch = Partial<Pick<Bot, "avatarCrop" | "avatarUrl" | "color">>;

export function BotProfileAvatarCard({
  bot,
  onPatch,
}: {
  bot: Bot;
  onPatch: (patch: AvatarPatch) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const saved = await imageAttachmentFromFile(file);
      if (!saved) throw new Error("Choose a PNG, JPEG, GIF, or WebP image");
      const avatarUrl = botAvatarUrlFromStoredPath(saved.path);
      if (!avatarUrl) throw new Error("The uploaded image could not be used as an avatar");
      onPatch({ avatarUrl, avatarCrop: "circle" });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const useDefaultAvatar = () => {
    setError(null);
    onPatch({ avatarUrl: null, avatarCrop: "initials" });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-hairline/40 bg-card">
      <div className="flex items-center justify-between border-b border-hairline/40 px-3 py-2.5">
        <span className="rounded-lg bg-control px-3 py-1.5 text-[14px] font-medium text-ink">Avatar</span>
        <button
          type="button"
          onClick={() => onPatch({ avatarUrl: null, avatarCrop: "initials", color: agentColorForName(bot.name) })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-ink-secondary hover:bg-control hover:text-ink"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="p-3">
        <div className="flex justify-center py-3">
          <BotAvatar bot={bot} size={112} />
        </div>

        <div className="mt-2 flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-control px-3 py-2 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            Upload image
          </button>
          {bot.avatarUrl && (
            <button
              type="button"
              onClick={useDefaultAvatar}
              disabled={uploading}
              aria-label="Remove custom avatar image"
              title="Use robot avatar"
              className="flex size-10 items-center justify-center rounded-lg text-ink-secondary hover:bg-control hover:text-danger disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <div className="mt-1.5 text-[11.5px] text-ink-secondary">PNG, JPEG, GIF, or WebP · up to 10 MB</div>

        <div className="mb-2 mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
          Avatar color
        </div>
        <div className="flex flex-wrap gap-2.5">
          {AGENT_COLOR_NAMES.map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={bot.color === color}
              onClick={() => onPatch({ color })}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 border-transparent text-[11px] font-semibold transition-transform hover:scale-110",
                bot.color === color && "ring-2 ring-accent-border ring-offset-2 ring-offset-card",
              )}
              style={{ borderColor: bot.color === color ? AGENT_COLORS[color] : undefined }}
              title={color}
              aria-label={`Use ${color} avatar color`}
            >
              <BotAvatar bot={{ name: bot.name, color }} size={36} animated={false} trackPointer={false} />
            </button>
          ))}
        </div>

        {error && <div role="alert" className="mt-3 text-[12px] text-danger">{error}</div>}
      </div>
    </div>
  );
}
