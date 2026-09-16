import type { CursorState } from "@/components/CursorAvatar";

export {
  AGENT_COLORS as MAUS_COLORS,
  AGENT_COLOR_NAMES as MAUS_COLOR_NAMES,
  type AgentColor as MausColor,
} from "../../shared/agent-avatar";

export type MausState = CursorState;
export type MausMotion =
  | "none"
  | "arrive"
  | "switch"
  | "customize"
  | "alert"
  | "thinking"
  | "working"
  | "launch"
  | "success"
  | "celebrate"
  | "blink"
  | "surprise"
  | "failure";
