import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, CheckCircle2, ChevronDown, ChevronRight, Hash, MessageCircle,
  Plus, Search, Settings2, Users,
} from "lucide-react";
import { formatTime, useStore, type Bot as Agent, type Group } from "@/state/store";
import { BotAvatar } from "./Avatar";
import { cn } from "@/lib/cn";

type WorkspaceView = "chats" | "channels" | "tasks" | "agents";
type ChatFilter = "all" | "channels" | "direct" | "unread";
const CHAT_FILTERS = ["all", "channels", "direct", "unread"] satisfies readonly ChatFilter[];

interface ChatRow {
  id: string;
  threadId: string;
  title: string;
  owner: string;
  kind: "channel" | "direct";
  at: number;
  preview: string;
  unread: boolean;
  agent?: Agent;
  group?: Group;
}

function messagePreview(messages: Agent["messages"]) {
  const message = messages.at(-1);
  if (!message) return { at: 0, text: "No messages yet" };
  if (message.kind === "activity") return { at: message.at, text: message.tool?.name ?? "Working…" };
  return { at: message.at, text: message.role === "user" ? `You: ${message.text ?? ""}` : message.text ?? "" };
}

function directChats(agent: Agent): ChatRow[] {
  return (agent.tasks ?? []).map((task) => {
    const active = task.threadId === agent.threadId;
    const messages = active ? agent.messages : [];
    const preview = messagePreview(messages);
    return {
      id: `${agent.id}:${task.threadId}`,
      threadId: task.threadId,
      title: task.title || "New chat",
      owner: agent.name,
      kind: "direct",
      at: preview.at || task.createdAt,
      preview: active && agent.busy ? "Working…" : preview.text,
      unread: active && agent.unread,
      agent,
    };
  });
}

function channelChat(group: Group): ChatRow {
  const preview = messagePreview(group.messages);
  return {
    id: group.id,
    threadId: group.threadId,
    title: group.name,
    owner: group.name,
    kind: "channel",
    at: preview.at || group.createdAt,
    preview: group.busyBotId ? "Coordinator is working…" : preview.text,
    unread: group.unread,
    group,
  };
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof MessageCircle; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={cn("flex size-11 items-center justify-center rounded-xl transition-colors", active ? "bg-accent text-white" : "text-ink-secondary hover:bg-raised hover:text-ink")}>
      <Icon size={19} />
    </button>
  );
}

function ConversationRow({ row, selected, onOpen }: { row: ChatRow; selected: boolean; onOpen: () => void }) {
  const subtitle = row.title === row.owner ? row.preview : row.title;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left",
        selected ? "bg-accent/10" : "hover:bg-raised/70",
      )}
    >
      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", row.kind === "channel" ? "bg-accent/10 text-accent" : "bg-raised text-ink-secondary")}>
        {row.kind === "channel" ? <Hash size={16} /> : row.agent ? <BotAvatar bot={row.agent} state="happy" size={26} animated={false} /> : <Bot size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-ink">{row.owner}</span>
          <span className="ml-auto shrink-0 text-[11px] text-ink-secondary">{row.at ? formatTime(row.at) : ""}</span>
        </span>
        <span className="block truncate text-[12px] text-ink-secondary">{subtitle}</span>
      </span>
      {row.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
    </button>
  );
}

function NewChatMenu({ agents, open, onOpenChange, onSelect }: {
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (agent: Agent) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !menuRef.current?.contains(target)) onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onOpenChange(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("mousedown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
        title="New Chat"
        aria-label="New Chat"
      >
        <Plus size={18} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Choose an agent for the new chat"
          className="absolute right-0 top-full z-50 mt-1 w-[300px] overflow-hidden rounded-xl border border-hairline/60 bg-card p-1.5 shadow-2xl shadow-black/60"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-secondary">New chat with</p>
          <div className="max-h-[min(360px,55vh)] overflow-y-auto">
            {agents.map((agent, index) => (
              <button
                key={agent.id}
                type="button"
                role="menuitem"
                autoFocus={index === 0}
                onClick={() => onSelect(agent)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-raised"
              >
                <BotAvatar bot={agent} state="happy" size={28} animated={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{agent.name}</span>
                  <span className="block truncate text-[11px] text-ink-secondary">{agent.title || "Agent"}</span>
                </span>
              </button>
            ))}
            {agents.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-ink-secondary">No agents available</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Conversation-first navigation. It deliberately maps legacy `Task` records
 * to the user-facing Chat term: each already has its own transcript and native
 * provider cursor, so no history or session migration is required. */
export function WorkspaceNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<WorkspaceView>("chats");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const chats = useMemo(() => [
    ...state.groups.map(channelChat),
    ...state.bots.filter((agent) => !agent.hidden).flatMap(directChats),
  ].sort((a, b) => b.at - a.at), [state.bots, state.groups]);
  const term = query.trim().toLowerCase();
  const visibleChats = chats.filter((chat) =>
    (filter === "all" || filter === chat.kind || (filter === "unread" && chat.unread)) &&
    (!term || `${chat.title} ${chat.owner} ${chat.preview}`.toLowerCase().includes(term)),
  );
  const selectedGroup = state.groups.find((group) => group.id === state.selectedId);
  const selectedAgent = selectedGroup
    ? undefined
    : state.bots.find((agent) => agent.id === state.selectedId);
  const selectedChatId = selectedGroup?.id
    ?? (selectedAgent ? `${selectedAgent.id}:${selectedAgent.threadId}` : undefined);
  const openChat = (chat: ChatRow) => {
    if (chat.agent) {
      dispatch({ type: "select", id: chat.agent.id });
      if (chat.threadId !== chat.agent.threadId) dispatch({ type: "switchTask", botId: chat.agent.id, threadId: chat.threadId });
    } else if (chat.group) dispatch({ type: "select", id: chat.group.id });
    onClose();
  };
  const createDirectChat = (agent: Agent) => {
    dispatch({ type: "select", id: agent.id });
    dispatch({ type: "newTask", botId: agent.id });
    setNewChatOpen(false);
    setView("chats");
  };

  const title = view === "chats" ? "Chats" : view === "channels" ? "Channels" : view === "tasks" ? "Tasks" : "Agents";
  return (
    <aside className={cn("z-40 flex h-full shrink-0 border-r border-hairline/50 bg-panel max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:w-[344px] max-md:shadow-2xl", open ? "max-md:translate-x-0" : "max-md:-translate-x-full", "transition-transform md:w-[352px]") }>
      <nav className="flex w-16 flex-col items-center gap-2 border-r border-hairline/40 px-2 pb-3 pt-3">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">R</div>
        <NavButton active={view === "chats"} icon={MessageCircle} label="Chats" onClick={() => setView("chats")} />
        <NavButton active={view === "channels"} icon={Hash} label="Channels" onClick={() => setView("channels")} />
        <NavButton active={view === "tasks"} icon={CheckCircle2} label="Tasks" onClick={() => setView("tasks")} />
        <NavButton active={view === "agents"} icon={Bot} label="Agents" onClick={() => setView("agents")} />
        <span className="flex-1" />
        <NavButton active={false} icon={Settings2} label="Settings" onClick={() => dispatch({ type: "toggleAppSettings" })} />
      </nav>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 px-4">
          <h1 className="text-[15px] font-semibold text-ink">{title}</h1>
          <span className="flex-1" />
          {(view === "chats" || view === "agents") && (
            <NewChatMenu
              agents={state.bots.filter((agent) => !agent.hidden)}
              open={newChatOpen}
              onOpenChange={setNewChatOpen}
              onSelect={createDirectChat}
            />
          )}
        </header>
        {(view === "chats" || view === "agents") && <label className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-hairline/50 bg-inset px-2.5 py-2 text-ink-secondary"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === "chats" ? "Search chats" : "Search agents"} className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-secondary" /></label>}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {view === "chats" && <>
            <div className="mb-2 flex gap-1 px-1">{CHAT_FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={cn("rounded-md px-2 py-1 text-[11px] capitalize", filter === item ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink")}>{item}</button>)}</div>
            {visibleChats.map((chat) => <ConversationRow key={chat.id} row={chat} selected={chat.id === selectedChatId} onOpen={() => openChat(chat)} />)}
            {visibleChats.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-ink-secondary">No matching chats</p>}
          </>}
          {view === "channels" && state.groups.map((group) => {
            const members = group.memberIds.map((id) => state.bots.find((agent) => agent.id === id)).filter((agent): agent is Agent => Boolean(agent));
            const isOpen = expanded[group.id] ?? true;
            return <div key={group.id} className="mb-1"><button type="button" onClick={() => setExpanded((value) => ({ ...value, [group.id]: !isOpen }))} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-raised"><span className="text-ink-secondary">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><Hash size={16} className="text-accent" /><span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{group.name}</span></button>{isOpen && <div className="ml-7 border-l border-hairline/40 pl-2"><button type="button" onClick={() => openChat(channelChat(group))} className="w-full rounded-md px-2 py-1.5 text-left text-[12px] text-ink-secondary hover:bg-raised hover:text-ink">{group.name}</button><p className="px-2 py-1 text-[11px] text-ink-secondary">Coordinator · {members.length} agents</p></div>}</div>;
          })}
          {view === "tasks" && <>{chats.filter((chat) => chat.kind === "direct").map((chat) => <button key={chat.id} type="button" onClick={() => openChat(chat)} className="mb-1 w-full rounded-lg border border-hairline/35 px-3 py-2 text-left hover:bg-raised"><span className="flex items-center gap-2 text-[13px] text-ink"><CheckCircle2 size={15} className={chat.agent?.busy ? "text-accent" : "text-ink-secondary"} />{chat.title}</span><span className="ml-6 block truncate text-[11px] text-ink-secondary">{chat.owner} · {chat.agent?.busy ? "In progress" : "Conversation"}</span></button>)}{state.groups.flatMap((group) => group.coordination?.tasks ?? []).map((task) => <button key={task.id} type="button" onClick={() => dispatch({ type: "select", id: state.groups.find((group) => group.coordination?.tasks.some((candidate) => candidate.id === task.id))!.id })} className="mb-1 w-full rounded-lg border border-hairline/35 px-3 py-2 text-left hover:bg-raised"><span className="text-[13px] text-ink">{task.title}</span><span className="block text-[11px] text-ink-secondary">{task.botName} · {task.status}</span></button>)}</>}
          {view === "agents" && state.bots.filter((agent) => !agent.hidden && (!term || `${agent.name} ${agent.title} ${agent.description}`.toLowerCase().includes(term))).map((agent) => <div key={agent.id} className="mb-2 rounded-xl border border-hairline/50 bg-card p-3"><div className="flex items-center gap-2"><BotAvatar bot={agent} state="happy" size={28} animated={false} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{agent.name}</span><span className="block truncate text-[11px] text-ink-secondary">{agent.title || "Agent"}</span></span><span className="size-2 rounded-full bg-success" title="Connected" /></div><button type="button" onClick={() => createDirectChat(agent)} className="mt-2 w-full rounded-md bg-raised px-2 py-1.5 text-[12px] text-ink hover:bg-raised-hover">New Chat</button></div>)}
        </div>
        <button type="button" onClick={() => dispatch({ type: "toggleAppSettings" })} className="mx-3 mb-3 flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-ink-secondary hover:bg-raised hover:text-ink"><Users size={15} />Workspace settings</button>
      </section>
    </aside>
  );
}
