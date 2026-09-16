import { EventEmitter } from "node:events";
import type { DesktopResponse } from "../ipc-entry.ts";
import type { subscribeDesktopFrames } from "../index.ts";

type UtilityMessage =
  | { type: "roundtable:ready"; pid: number; endpoint: string }
  | { type: "roundtable:response"; id: string; response: DesktopResponse }
  | { type: "roundtable:event"; frame: Parameters<Parameters<typeof subscribeDesktopFrames>[0]>[0] };

// Adapt Node's test subprocess IPC to Electron's utility-process parent port.
const parentPort = Object.assign(new EventEmitter(), {
  postMessage: (message: UtilityMessage) => process.send?.(message),
});
Object.assign(process, { parentPort });
process.on("message", (data) => parentPort.emit("message", { data }));
await import("../ipc-entry.ts");
