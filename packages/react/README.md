# @deepgram/react

React provider and hooks for the [Deepgram Voice Agent API](https://developers.deepgram.com/docs/voice-agent). Manages connection lifecycle, microphone, audio playback, conversation state, and mode tracking.

For pre-built UI components, see [`@deepgram/ui`](https://github.com/deepgram/ui).

## Status

This package is pre-1.0. Interfaces may change between minor versions.

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
        agent: { think: { provider: { type: 'open_ai' }, model: 'gpt-4o-mini' } },
      }}
    >
      <VoiceAgent />
    </AgentProvider>
  );
}

function VoiceAgent() {
  const { state, start, stop } = useAgentState();
  const { conversation, sendUserMessage } = useAgentConversation();

  return (
    <div>
      <button onClick={state === "idle" ? start : stop}>
        {state === "idle" ? "Start" : "Stop"}
      </button>
      {conversation.map((entry) => (
        <p key={entry.id}><b>{entry.role}:</b> {entry.content}</p>
      ))}
    </div>
  );
}
```

## AgentProvider

Wraps your component tree with agent state management. Creates and manages an `AgentSession`, `AgentMicrophone`, and `AgentPlayer` internally.

```tsx
<AgentProvider
  config={agentSessionConfig}   // Required: AgentSessionConfig
  microphone={true}             // Enable microphone capture (default: true)
  microphoneOptions={{}}        // MicrophoneOptions (VAD, sample rate, etc.)
  tts={true}                    // Enable audio playback (default: true)
  playerSampleRate={24_000}     // Agent audio sample rate (default: 24_000)
  autoStart={false}             // Auto-connect on mount (default: false)
  onFunctionCall={handler}      // Fallback function call handler
>
  {children}
</AgentProvider>
```

### Mode Tracking

The provider tracks three agent modes: `"idle"`, `"listening"`, and `"speaking"`.

The speaking-to-listening transition is **playback-aware** -- when the server fires `AgentAudioDone`, the provider waits until `AgentPlayer.getRemainingPlaybackTime()` reaches zero before switching to `"listening"`. This prevents premature mode changes while audio is still playing.

## Hooks

### useAgentState

Connection state and lifecycle controls.

```ts
const {
  state,          // "idle" | "connecting" | "connected" | "reconnecting" | "disconnected"
  isIdle,         // boolean
  isConnecting,   // boolean
  isConnected,    // boolean
  isReconnecting, // boolean
  isDisconnected, // boolean
  isActive,       // true when connected, connecting, or reconnecting
  start,          // () => Promise<void>
  stop,           // () => void
} = useAgentState();
```

### useAgentMode

Speaking/listening mode.

```ts
const {
  mode,        // "idle" | "listening" | "speaking"
  isSpeaking,  // boolean
  isListening, // boolean
} = useAgentMode();
```

### useAgentConversation

Conversation transcript and text messaging.

```ts
const {
  conversation,       // ConversationEntry[] -- { id, role, content, timestamp }
  clearConversation,  // () => void
  sendUserMessage,    // (text: string) => void
} = useAgentConversation();
```

### useAgentMicrophone

Microphone state, mute controls, and input volume.

```ts
const {
  micActive,       // boolean -- hardware is open
  micMuted,        // boolean -- muted (open but not sending)
  setMicMuted,     // (muted: boolean) => void
  toggle,          // () => void -- toggles mute
  enabled,         // boolean -- false when microphone={false} on provider
  getInputVolume,  // () => number -- 0-1, call per animation frame
} = useAgentMicrophone();
```

### useAgentPlayer

Audio playback state, mute controls, and output volume.

```ts
const {
  outputMuted,      // boolean
  setOutputMuted,   // (muted: boolean) => void
  toggle,           // () => void
  enabled,          // boolean -- false when tts={false} on provider
  getOutputVolume,  // () => number -- 0-1, call per animation frame
} = useAgentPlayer();
```

### useAgentControls

Stable action methods that never change identity. Use in components that trigger actions but do not display state.

```ts
const {
  start,
  stop,
  sendUserMessage,
  clearConversation,
  setMicMuted,
  setOutputMuted,
} = useAgentControls();
```

### useAgentClientTool

Register a client-side function call handler scoped to the component's lifecycle. Automatically unregisters on unmount.

```tsx
function WeatherPanel() {
  useAgentClientTool("getWeather", async (fn) => {
    const { city } = JSON.parse(fn.input);
    const data = await fetchWeather(city);
    return JSON.stringify(data);
  });

  return <div>...</div>;
}
```

Dynamic client tools are checked before the `onFunctionCall` fallback prop on `AgentProvider`.

### useAgentSession

Direct access to the underlying `AgentSession` instance (escape hatch).

```ts
const session = useAgentSession();
session.on("warning", (msg) => console.warn(msg));
```

### useAgentContext

Raw context value (escape hatch). Returns the full `AgentContextValue`. Prefer focused hooks for better render performance.

### useDeepgramAgent (standalone)

Self-contained hook that does not require `AgentProvider`. Creates and manages its own session, microphone, and player. Useful for simple integrations or when you don't need the provider/context pattern.

```ts
const {
  state, micActive, outputMuted, conversation,
  start, stop, setMicMuted, setOutputMuted, sendUserMessage, interrupt,
} = useDeepgramAgent({
  config: {
    auth: { tokenFactory: () => fetch('/api/token').then(r => r.text()) },
    agent: { think: { provider: { type: 'open_ai' }, model: 'gpt-4o-mini' } },
  },
});
```

## Exports

All hooks, the provider, context types, and common SDK types (re-exported from `@deepgram/agents` for convenience):

```ts
// Provider
export { AgentProvider };
export type { AgentProviderProps };

// Hooks
export {
  useAgentState, useAgentMode, useAgentConversation,
  useAgentMicrophone, useAgentPlayer, useAgentControls,
  useAgentClientTool, useAgentSession, useAgentContext,
  useDeepgramAgent,
};

// Hook result types
export type {
  UseAgentStateResult, UseAgentConversationResult,
  UseAgentMicrophoneResult, UseAgentPlayerResult,
  UseAgentModeResult, UseAgentControlsResult,
  UseDeepgramAgentResult, UseDeepgramAgentOptions,
};

// Context types
export type { AgentContextValue, ConversationEntry, AgentMode };

// SDK types (re-exported from @deepgram/agents)
export type {
  AgentSessionConfig, AuthConfig, TokenFactory,
  AgentSettingsObject, ThinkSettings, SpeakSettings,
  MicrophoneOptions,
};
```

## License

MIT
