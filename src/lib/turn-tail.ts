import type { Message } from "@/state/store";

/** Provider streams may begin with formatting whitespace. Treat that as no
 * visible reply so the working indicator is not replaced by a lone caret. */
export function hasVisibleStreamingText(streaming: string | undefined): streaming is string {
  if (!streaming) return false;
  const content = streaming.replace(/[\s\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e\p{Cf}]/gu, "");
  return content.length > 0;
}

/** Whether the transcript tail should show the "working" dots.
 *
 * A turn ends across three server frames: the settled reply (`message`),
 * `turn.completed`, then the bot patch that flips `busy` off. Deriving the
 * dots from `busy && !streaming` alone re-shows them in that window — the
 * reply lands, the dots pop back under it for a beat, then vanish — and the
 * pinned scroll re-anchors around each height change. That grow-shrink-jump
 * is the end-of-stream jitter. A settled reply at the tail means there is
 * nothing to wait for, so the dots stay hidden until something actually new
 * starts: a tool chip, the user's next prompt, or (in rooms) a different
 * speaker taking the floor.
 */
export function showWorkingDots(
  busy: boolean | undefined,
  streaming: string | undefined,
  lastMessage: Message | undefined,
  /** rooms: the bot currently speaking. A settled reply from a PREVIOUS
   * speaker doesn't cover this one — its dots are real information. */
  speakerBotId?: string,
): boolean {
  if (!busy || hasVisibleStreamingText(streaming)) return false;
  if (!lastMessage) return true;
  const settledReply = lastMessage.role === "bot" && lastMessage.kind === "text";
  if (!settledReply) return true;
  return speakerBotId !== undefined && lastMessage.from?.botId !== speakerBotId;
}
