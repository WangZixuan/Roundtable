import { useState } from "react";
import { z } from "zod";
import { api, type Message } from "@/state/store";
import { ChatMarkdown } from "./ChatMarkdown";

/** Files are server-published task artifacts, not paths parsed from Bot prose.
 * The server rechecks both publication and workspace containment when opened. */
const artifactResponse = z.union([
  z.object({ name: z.string(), text: z.string() }),
  z.object({ name: z.string(), base64: z.string() }),
]);

export function BotDelivery({ botId, message }: { botId: string; message: Message }) {
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const open = async (artifact: NonNullable<Message["artifacts"]>[number]) => {
    setError(null);
    setLoading(artifact.path);
    try {
      const response = await api(`/api/bots/${botId}/artifacts?${new URLSearchParams({ path: artifact.path, threadId: artifact.threadId })}`);
      const result = artifactResponse.parse(response);
      if ("text" in result) setPreview({ name: result.name, text: result.text });
      else {
        const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = result.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open artifact");
    } finally {
      setLoading(null);
    }
  };

  if (!message.artifacts?.length) return null;
  return <>
    <section className="mt-4 border-t border-hairline/40 pt-3" aria-label="Task deliverables">
      <div className="mb-1 text-[12px] font-semibold text-ink-secondary">Deliverables</div>
      {message.artifacts.map((artifact) => <button key={`${artifact.threadId}:${artifact.path}`} title={artifact.path} disabled={loading !== null}
        onClick={() => void open(artifact)} className="block break-all text-left text-[13px] text-accent underline">
        {loading === artifact.path ? "Opening… " : ""}{artifact.label}
      </button>)}
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </section>
    {preview && <div className="mt-2 rounded-lg border border-hairline/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-[12px] font-medium text-ink">{preview.name}</span><button onClick={() => setPreview(null)} className="text-[12px] text-ink-secondary hover:text-ink">Close</button></div>
      <ChatMarkdown text={preview.text} />
    </div>}
  </>;
}
