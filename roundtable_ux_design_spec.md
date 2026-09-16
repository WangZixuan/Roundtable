# Roundtable UX Design Specification

**Status:** Implementation proposal\
**Audience:** Codex / Roundtable developers\
**Scope:** Desktop navigation, conversations, channels, agents, and
tasks\
**Primary goal:** Replace the current `Channels + Bots` sidebar model
with a scalable conversation-centric UX that supports heterogeneous
backend agents such as Codex, GitHub Copilot CLI, Microsoft Copilot, and
custom/domain agents.

------------------------------------------------------------------------

## 1. Product model

Roundtable is a workspace where users can either work directly with one
agent or collaborate with a team of agents inside a Channel.

The UX must keep these concepts distinct:

  -----------------------------------------------------------------------
  Concept                             Meaning
  ----------------------------------- -----------------------------------
  **Agent**                           A capability/provider. It may be
                                      backed by Codex, GitHub Copilot
                                      CLI, Microsoft Copilot, or another
                                      agent runtime.

  **Channel**                         A persistent multi-agent
                                      team/workspace with a coordinator
                                      and members.

  **Chat / Conversation**             A bounded user work context. Both
                                      Channels and Direct Agents can own
                                      multiple chats.

  **Backend Session**                 Native runtime session belonging to
                                      an agent. It is implementation
                                      state, not the primary user-facing
                                      navigation object.

  **Task**                            Executable work created from a
                                      conversation. It has
                                      status/progress/ownership
                                      independent of chat messages.

  **Artifact**                        Output produced by work: files,
                                      code changes, reports, images, etc.
  -----------------------------------------------------------------------

### Core relationships

``` text
Roundtable
│
├── Channel
│   ├── Members
│   ├── Coordinator
│   └── Chats
│       └── Channel Chat
│           ├── Messages
│           ├── Agent Sessions
│           ├── Tasks
│           └── Artifacts
│
├── Agent
│   └── Direct Chats
│       └── Direct Chat
│           ├── Messages
│           ├── Backend Session
│           ├── Tasks
│           └── Artifacts
│
└── Tasks
    └── Aggregated execution view
```

**Important:** `Chats` is an aggregated UX view, not a separate
ownership domain. A conversation is owned by either a Channel or a
Direct Agent.

------------------------------------------------------------------------

## 2. Design principles

### 2.1 Conversation-first navigation

The default entry point should answer:

> What was I working on recently?

Users should not need to remember which backend agent they used before
they can resume work.

### 2.2 Preserve native agent behavior

Roundtable should normalize navigation, sessions, tasks, artifacts, and
orchestration, but should **not** force all agents into identical
capabilities.

Examples:

-   Codex may expose working directory, shell/code capabilities,
    approvals, and model selection.
-   Microsoft Copilot may expose enterprise/web sources instead of a
    working directory.
-   A financial agent may expose portfolio/data-source controls.

The composer and detail UI should be capability-driven.

### 2.3 Chat is not Task

Do not use **New Task** to mean "start another conversation."

Use:

-   **New Chat** → creates a conversation context.
-   **New Task** → creates executable work.

A chat may create zero, one, or many tasks.

### 2.4 Channel is not Chat

A Channel persists as a team configuration and contains multiple chats.

``` text
Plum & Co.
├── Roundtable Memory Architecture
├── ACP Architecture
├── Demo Video
└── + New Chat
```

Starting a new topic should not require creating another Channel.

------------------------------------------------------------------------

## 3. Top-level application layout

Use a four-area desktop layout:

``` text
┌────────┬──────────────────────┬───────────────────────────────┬────────────────────┐
│ Global │ Context Navigation   │ Main Workspace                │ Details            │
│ Nav    │                      │                               │ optional/collapsible│
│        │                      │                               │                    │
│ Chats  │ Recent conversations │ Conversation                  │ Chat / task info   │
│Channel │ Channel chats        │ Messages                      │ Workspace          │
│ Tasks  │ Agent chats          │ Task cards                    │ Capabilities       │
│ Agents │ Search/filter        │ Artifacts                     │ Related items      │
│        │                      │ Composer                      │                    │
└────────┴──────────────────────┴───────────────────────────────┴────────────────────┘
```

Recommended approximate widths on a large desktop:

-   Global navigation: `64–72px`
-   Context navigation: `280–340px`
-   Main workspace: flexible, minimum `600px`
-   Details panel: `280–340px`, collapsible

The right details panel is optional. The main workspace must remain
usable when it is hidden.

------------------------------------------------------------------------

## 4. Global navigation

Replace the current top-level `CHANNELS` and `BOTS` sections with
persistent application navigation.

``` text
┌──────────┐
│    R     │
│          │
│ 💬 Chats │
│ # Channel│
│ ✓ Tasks  │
│ 🤖 Agents│
│          │
│          │
│ Team     │
│ Settings │
│          │
│ Profile  │
└──────────┘
```

Required primary destinations:

1.  **Chats** --- aggregated recent conversations.
2.  **Channels** --- multi-agent workspace management.
3.  **Tasks** --- execution/status view across conversations.
4.  **Agents** --- agent registry and configuration.

`Chats` should be the default landing view.

------------------------------------------------------------------------

## 5. Chats view

### Purpose

Answer:

> What conversations have I recently worked in?

The list mixes **Channel Chats** and **Direct Chats**, ordered primarily
by recent activity.

### Context navigation

``` text
Chats                                      +

┌ Search chats, channels, agents... ──────┐
│ All      Channels      Direct     Unread │
└──────────────────────────────────────────┘

PINNED

#  Plum & Co.
   Roundtable Memory Architecture
   Plum + 2 agents                    9:42 AM

RECENT

◉  Codex
   ACP message filtering
   Fixed final-output handling        9:15 AM

#  Plum & Co.
   Roundtable UX Design
   Plum + Codex                       Yesterday

◉  Microsoft Copilot
   Teams architecture research
   Found related documents            Yesterday

#  Video AI Research
   Streaming VLM architecture
   3 agents                           Sep 12
```

### Conversation row requirements

Each row should expose:

-   conversation title
-   owner identity
    -   Channel name for channel conversations
    -   Agent name for direct conversations
-   owner/type icon
-   last activity timestamp
-   short last-message/status preview
-   unread state when applicable
-   optional pin state

Do not make the user infer the type from the title alone.

### Filters

Support:

``` text
All | Channels | Direct | Unread
```

Do not initially create separate permanent sidebar sections for Channel
Chats and Direct Chats. The chronological "recent work" model is more
useful for the default Chats view.

------------------------------------------------------------------------

## 6. Channels view

### Purpose

Answer:

> What teams/workspaces do I have, and what are they working on?

### Context navigation

``` text
Channels                             + New Channel

▼ Plum & Co.                              +
  Plum · Coordinator · 3 agents

    Roundtable Memory Architecture
    Roundtable UX Design
    ACP Architecture

    + New Chat

▶ Video AI Research                       +
  Atlas · Coordinator · 4 agents

▶ Interview Team                          +
```

The `+` action on a Channel creates a **New Chat in that Channel**, not
a new task.

### Channel selection

Selecting the Channel itself should open a Channel overview:

``` text
# Plum & Co.

Coordinator
  Plum

Members
  Plum
  Codex
  Critic

Recent Chats
  Roundtable Memory Architecture
  Roundtable UX Design
  ACP Architecture

Active Tasks
  2 running
  1 waiting for approval

[New Chat]
```

### Channel chat

Selecting a child conversation opens the normal conversation workspace.

Header example:

``` text
# Plum & Co. / Roundtable UX Design              ⋯
3 agents                                         Details
```

Channel conversation messages can contain:

-   user/coordinator messages
-   relevant member-agent final responses
-   delegation/status cards
-   task cards
-   artifacts

Low-level backend tool-call logs should not become normal Channel
messages unless explicitly requested.

------------------------------------------------------------------------

## 7. Direct Agent chats

### Purpose

Allow an agent to retain its native one-to-one interaction model while
supporting multiple independent conversation contexts.

Example:

``` text
Codex
├── ACP message filtering
├── Memory implementation
├── Roundtable backend
└── + New Chat
```

`New Chat` should create a fresh Direct Conversation and, when required
by the backend, a fresh native agent session.

### Direct chat header

``` text
Codex
Coding Agent · Codex backend

ACP message filtering  ▾            + New Chat     ⋯
```

The conversation dropdown may provide quick switching between that
agent's chats, but it should not be the only way to discover chats; the
context sidebar remains the primary navigation mechanism.

------------------------------------------------------------------------

## 8. Agents view

### Purpose

This is the **Agent Registry**, not the main chat history.

``` text
Agents                                      + Add Agent

Coding
┌─────────────────────────────────────────────┐
│ Codex                          ● Connected  │
│ Coding Agent · Codex backend                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ GitHub Copilot                 ● Connected  │
│ Coding Agent · Copilot CLI                  │
└─────────────────────────────────────────────┘

Knowledge
┌─────────────────────────────────────────────┐
│ Microsoft Copilot              ● Connected  │
│ Enterprise Assistant                        │
└─────────────────────────────────────────────┘

Custom
  Plum
  Wren
```

### Agent detail page

``` text
Codex

Coding Agent
Backend: Codex

[New Chat]

Recent Chats
  ACP message filtering
  Memory implementation
  Roundtable backend

Capabilities
  ✓ File access
  ✓ Working directory
  ✓ Code execution
  ✓ Approval requests
  ✓ Long-running work

Defaults
  Workspace: ~/roundtable
  Model: <backend-specific>

Connection
  ● Connected
```

Avoid presenting unsupported controls merely for visual consistency.

------------------------------------------------------------------------

## 9. Tasks view

### Purpose

Answer:

> What work are my agents currently executing?

Tasks should aggregate across Direct Chats and Channel Chats.

``` text
Tasks

[All] [Running] [Waiting] [Completed]

RUNNING

● Implement memory layer
  Codex
  Roundtable Memory Architecture
  In progress · 12m

● Research memory alternatives
  Researcher
  # Plum & Co.
  In progress · 3m

WAITING FOR YOU

⚠ Approve file modification
  Codex
  ACP message filtering

COMPLETED

✓ ACP final-output filtering
  Codex
  Yesterday
```

Task rows should link back to the originating conversation.

A Task should have at least:

``` text
id
title
status
assigned_agent
origin_conversation_id
origin_channel_id?       // nullable for direct chats
created_at
updated_at
progress?
approval_state?
artifacts[]
```

------------------------------------------------------------------------

## 10. Main conversation workspace

Use one common conversation shell with type-specific behavior.

### Direct Chat

``` text
┌──────────────────────────────────────────────────────────┐
│ Codex                                                    │
│ Coding Agent · Codex backend                             │
│                                                         │
│ ACP message filtering ▾       + New Chat    Search   ⋯  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ You                                                      │
│ Fix the ACP output filtering...                          │
│                                                          │
│ Codex                                                    │
│ I'll inspect the message pipeline...                     │
│                                                          │
│ ┌ Task ────────────────────────────────────────────────┐ │
│ │ Fix final-output handling                In progress │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Message Codex...                                         │
│ 📎  Working folder   Approval   Model                    │
└──────────────────────────────────────────────────────────┘
```

### Channel Chat

``` text
┌──────────────────────────────────────────────────────────┐
│ # Plum & Co.                                             │
│ Roundtable Memory Architecture                           │
│ 3 agents                                  Members    ⋯   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ You                                                      │
│ Design the memory layer for Roundtable.                  │
│                                                          │
│ Plum · Coordinator                                       │
│ I'll split this into research and architecture work.     │
│                                                          │
│ ┌ Research ────────────────────────────────────────────┐ │
│ │ Researcher                              In progress  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌ Architecture ────────────────────────────────────────┐ │
│ │ Architect                               In progress  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Message #Plum & Co...                                    │
│ 📎   @ Agent   Approval                                  │
└──────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## 11. Capability-driven composer

Do not hard-code Codex-specific controls into the generic composer.

Define capabilities for each agent/runtime, for example:

``` ts
interface AgentCapabilities {
  attachments?: boolean;
  workingDirectory?: boolean;
  approvalRequests?: boolean;
  modelSelection?: boolean;
  webSearch?: boolean;
  enterpriseSearch?: boolean;
  codeExecution?: boolean;
  longRunningTasks?: boolean;
  dataSources?: boolean;
}
```

Render composer actions from the selected agent/context.

### Codex example

``` text
Message Codex...

📎  Ask for approval  Working folder  Model
```

### Microsoft Copilot example

``` text
Ask Microsoft Copilot...

📎  Work/Web  Sources
```

### Channel example

The Channel composer is primarily coordinator-facing:

``` text
Message #Plum & Co...

📎  @Agent  Ask for approval
```

The coordinator determines delegation unless the user explicitly
mentions a member agent.

------------------------------------------------------------------------

## 12. Conversation lifecycle

### Create Direct Chat

``` text
User selects Agent
       │
       ▼
    New Chat
       │
       ▼
Create Conversation
owner_type = DIRECT_AGENT
owner_id   = agent_id
       │
       ▼
Create/initialize native backend session as needed
       │
       ▼
Open conversation
```

### Create Channel Chat

``` text
User selects Channel
       │
       ▼
    New Chat
       │
       ▼
Create Conversation
owner_type = CHANNEL
owner_id   = channel_id
       │
       ▼
Create Coordinator session
       │
       ▼
Open conversation
       │
       ▼
Member sessions created/bound lazily when delegated work begins
```

Do **not** automatically create native sessions for every Channel member
if no work has been delegated to them.

------------------------------------------------------------------------

## 13. Suggested conversation data model

Use a unified conversation representation where practical:

``` ts
type ConversationOwner =
  | {
      type: "direct_agent";
      agentId: string;
    }
  | {
      type: "channel";
      channelId: string;
    };

interface Conversation {
  id: string;
  title: string;
  owner: ConversationOwner;

  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;

  pinned?: boolean;
  unreadCount?: number;

  messages: MessageRef[];
  taskIds: string[];
  artifactIds: string[];
}
```

Backend sessions should be mapped separately:

``` ts
interface AgentSessionBinding {
  id: string;

  conversationId: string;
  agentId: string;

  backendType:
    | "codex"
    | "github_copilot"
    | "microsoft_copilot"
    | "custom";

  backendSessionId?: string;

  state:
    | "initializing"
    | "ready"
    | "running"
    | "waiting"
    | "failed"
    | "closed";
}
```

This prevents backend runtime identity from leaking into the main
UX/domain hierarchy.

------------------------------------------------------------------------

## 14. Right details panel

Make the right panel contextual and collapsible.

For a Direct Chat:

``` text
Session
ACP message filtering

Agent
Codex

Current Task
Fix final-output handling
● In progress

Workspace
~/roundtable

Model
...

Artifacts
3 files

Related
Previous chat
Tasks
```

For a Channel Chat:

``` text
Channel
Plum & Co.

Chat
Roundtable Memory Architecture

Coordinator
Plum

Members
3

Tasks
2 running
1 completed

Artifacts
4

[View Channel]
```

Do not show a working folder or model if the current agent/backend does
not expose those concepts.

------------------------------------------------------------------------

## 15. Naming rules

Use these terms consistently in UI and code-facing product concepts:

  Use                   Avoid
  --------------------- -------------------------------------------------
  Agent                 Bot
  Chat / Conversation   Task when referring to chat
  New Chat              New Task when starting a conversation
  Channel               Team Chat if it means persistent workspace
  Task                  Session
  Backend Session       Chat, unless it really is the user conversation
  Agents                Bots

Existing internal implementation names do not need to be renamed
immediately if doing so creates unnecessary migration risk, but
user-facing strings should follow this vocabulary.

------------------------------------------------------------------------

## 16. Interaction rules

### New Chat

A `+ New Chat` action should be available from:

-   Chats view
-   Channel
-   Agent detail
-   Direct Agent context
-   current conversation header

If invoked globally from Chats, show a lightweight destination picker:

``` text
New Chat

Channels
  # Plum & Co.
  # Video AI Research

Agents
  Codex
  Microsoft Copilot
  Plum
```

After the user selects the destination, create the appropriate
conversation type.

### Conversation title

Initially derive a short title from the first meaningful user request.
Allow rename.

Do not use `New task` as the persistent title.

### Delete/archive

Prefer **Archive Chat** as the normal removal operation. Destructive
deletion can live under a secondary menu.

### Empty state

For an Agent:

``` text
Start a new chat with Codex

Codex can work with code and files in a selected workspace.

[New Chat]
```

For a Channel:

``` text
Start a conversation with Plum & Co.

Plum coordinates work across the agents in this Channel.

[New Chat]
```

------------------------------------------------------------------------

## 17. Migration from current UX

Current UI roughly behaves as:

``` text
CHANNELS
  Plum & Co.

BOTS
  Codex
  Wren
  Plum
  Github Copilot

Tasks & routines
```

Migrate incrementally.

### Phase 1 --- terminology and chat sessions

-   Rename user-facing `Bots` → `Agents`.
-   Rename conversation-level `New task` → `New Chat`.
-   Allow multiple chats under every Direct Agent.
-   Allow multiple chats under every Channel.
-   Preserve existing backend sessions through conversation/session
    bindings.

### Phase 2 --- navigation

Introduce global navigation:

``` text
Chats
Channels
Tasks
Agents
```

Make `Chats` the default view.

Add aggregated conversation queries for Channel and Direct
conversations.

### Phase 3 --- execution UX

-   Separate Task state from conversation/session state.
-   Add global Tasks view.
-   Add task cards in conversations.
-   Link tasks back to their origin conversation.

### Phase 4 --- heterogeneous agent capabilities

-   Add explicit capability metadata.
-   Render composer/detail controls from capabilities.
-   Remove assumptions that all agents have working folders, models,
    shell access, or approvals.

------------------------------------------------------------------------

## 18. Implementation priorities

### P0

Implement these before additional visual polish:

-   unified Conversation abstraction
-   Channel owns multiple conversations
-   Direct Agent owns multiple conversations
-   `New Chat` semantics
-   conversation switching
-   persisted conversation titles/history
-   backend session binding per conversation
-   clear separation between Chat and Task

### P1

-   Chats aggregated view
-   global `Chats / Channels / Tasks / Agents` navigation
-   filters: All / Channels / Direct / Unread
-   Channel overview
-   Agent registry/detail
-   contextual right details panel

### P2

-   capability-driven composer
-   global Tasks dashboard
-   pin/unread/archive
-   artifacts aggregation
-   richer Channel delegation/task cards
-   search across conversations

------------------------------------------------------------------------

## 19. Acceptance criteria

The UX refactor is successful when all of the following are true:

1.  A user can create multiple independent chats with Codex without
    creating multiple Codex agents.
2.  A user can create multiple independent chats inside `Plum & Co.`
    without creating multiple Channels.
3.  Returning to Roundtable shows recent Direct and Channel
    conversations together in Chats.
4.  A user can identify whether a conversation belongs to a Channel or
    Direct Agent without opening it.
5.  Starting a conversation is consistently called **New Chat**.
6.  Tasks are displayed as execution objects rather than aliases for
    conversations.
7.  Each Channel Chat has its own coordinator conversation/session
    context.
8.  Backend member-agent sessions can be created lazily per Channel
    Chat.
9.  Switching between two chats does not accidentally reuse the wrong
    backend session/context.
10. Codex-specific controls are not displayed for an agent that does not
    support them.
11. The Agents page describes/configures agents rather than acting as
    the only chat-history view.
12. The Channels page describes/manages teams and exposes their
    individual chats.
13. Tasks link back to the conversation that created them.
14. Existing conversations can be migrated without losing history.

------------------------------------------------------------------------

## 20. Implementation guardrails for Codex

When implementing this proposal:

-   Do not perform a broad visual rewrite before the domain/navigation
    model works.
-   Reuse existing components where possible.
-   Keep backend-specific logic behind an adapter/capability interface.
-   Do not couple `Conversation.id` to a Codex/Copilot backend session
    ID.
-   Do not assume one Agent has exactly one session.
-   Do not assume one Channel has exactly one conversation.
-   Do not assume one Conversation has exactly one Task.
-   Do not eagerly initialize every Channel member for every new chat.
-   Keep existing ACP/backend message filtering behavior; internal
    tool-call events should remain available for diagnostics but should
    not automatically become user-visible Channel messages.
-   Prefer migration-compatible changes over destructive schema
    replacement.
-   Preserve the native behavior of each backend agent wherever it does
    not conflict with Roundtable's shared navigation/session model.

------------------------------------------------------------------------

## 21. Target mental model

The final UX should make these statements obvious to the user:

> **Chats:** Continue something I was working on.

> **Channels:** Work with a team of agents.

> **Tasks:** See what work is running or needs my attention.

> **Agents:** Choose or configure who can do the work.

And at the domain level:

``` text
Channel owns team configuration.
Agent owns capabilities/runtime identity.
Conversation owns interaction context.
Backend Session owns native runtime state.
Task owns execution state.
Artifact owns produced output.
```

This separation should guide both the UX implementation and the
underlying Roundtable architecture.
