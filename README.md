# @deepgram/react

[![npm version](https://img.shields.io/npm/v/@deepgram/react.svg)](https://www.npmjs.com/package/@deepgram/react)
[![license](https://img.shields.io/npm/l/@deepgram/react.svg)](LICENSE)
[![CI](https://github.com/deepgram/react/actions/workflows/ci.yml/badge.svg)](https://github.com/deepgram/react/actions/workflows/ci.yml)

React hooks and provider for the [Deepgram Voice Agent API](https://developers.deepgram.com/docs/voice-agent). Manages connection lifecycle, microphone capture, audio playback, conversation state, and mode tracking.

## Install

```bash
npm install @deepgram/react @deepgram/agents
```

## Quick Start

```tsx
import { AgentProvider, useAgentState, useAgentConversation } from "@deepgram/react";

function App() {
  return (
    <AgentProvider
      config={{
        auth: { tokenFactory: () => fetch('/api/deepgram-token').then(r => r.text()) },
        agent: { think: { provider: { type: 'open_ai', model: 'gpt-4o-mini' } } },
      }}
    >
      <VoiceAgent />
    </AgentProvider>
  );
}

function VoiceAgent() {
  const { state, start, stop } = useAgentState();
  const { conversation } = useAgentConversation();
  const handleStart = async () => {
    try {
      await start();
    } catch (error) {
      console.error("Failed to start voice agent", error);
    }
  };

  return (
    <div>
      <button onClick={state === "idle" ? handleStart : stop}>
        {state === "idle" ? "Start" : "Stop"}
      </button>
      {conversation.map((entry) => (
        <p key={entry.id}><b>{entry.role}:</b> {entry.content}</p>
      ))}
    </div>
  );
}
```

`config`, `playerSampleRate`, and the initial `autoStart` value establish the provider session for that component lifetime. Use the runtime update methods for supported listen, think, speak, and prompt changes rather than changing `config` in place.

## Hooks

| Hook | Purpose |
|------|---------|
| `useAgentState` | Connection state (`idle`, `connecting`, `connected`, etc.) and `start`/`stop` controls |
| `useAgentMode` | Listening/thinking/speaking mode tracking |
| `useAgentConversation` | Conversation transcript plus user and agent messages |
| `useAgentMicrophone` | Mic state, mute controls, input volume |
| `useAgentPlayer` | Audio playback state, mute controls, output volume |
| `useAgentControls` | Grouped lifecycle, messaging, settings, and mute controls |
| `useAgentClientTool` | Register client-side function call handlers scoped to component lifecycle |
| `useAgentSession` | Direct access to the underlying `AgentSession` (escape hatch) |
| `useDeepgramAgent` | Standalone hook -- no provider needed |

See the [package README](packages/react/README.md) for full API documentation.

## Related Packages

| Package | Repo | Description |
|---------|------|-------------|
| [`@deepgram/agents`](https://github.com/deepgram/agent) | `deepgram/agent` | Core SDK -- WebSocket session, microphone capture, audio playback |
| [`@deepgram/ui`](https://github.com/deepgram/ui) | `deepgram/ui` | Pre-built React UI components with Tailwind CSS theming |
| [`@deepgram/agents-widget`](https://github.com/deepgram/agent) | `deepgram/agent` | Self-contained widget (UMD + ESM) |

## Documentation

- [Deepgram Voice Agent docs](https://developers.deepgram.com/docs/voice-agent)
- [API reference](https://developers.deepgram.com/reference)
- [`@deepgram/ui` -- pre-built components](https://github.com/deepgram/ui)

## Development

**Prerequisites:** [Bun](https://bun.sh/) 1.3+

The published package depends on the npm release of `@deepgram/agents`. For coordinated local development, you can optionally clone a sibling checkout; this repository's TypeScript config uses it when present and otherwise resolves the npm package:

```bash
git clone git@github.com:deepgram/agent.git ../agent
cd ../agent && bun install && bun run build
```

Then:

```bash
git clone git@github.com:deepgram/react.git
cd react
bun install
```

```bash
bun run build       # Build @deepgram/react
bun run typecheck   # Type-check
bun run test        # Run tests
bun run dev         # Watch-build
```

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## License

MIT -- see [LICENSE](LICENSE)
