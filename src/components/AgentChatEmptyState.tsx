export function AgentChatEmptyState({ name, onNewChat }: { name: string; onNewChat: () => void }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-chat-background p-6 text-center">
      <h2 className="text-[16px] font-semibold text-ink">No chats with {name}</h2>
      <p className="text-[13px] text-ink-secondary">Start a new chat to work with this agent.</p>
      <button type="button" onClick={onNewChat}
        className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:brightness-110">
        New chat
      </button>
    </main>
  );
}
