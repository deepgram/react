# @deepgram/react

React provider and hooks for the [Deepgram Voice Agent API](https://developers.deepgram.com/docs/voice-agent). Manages connection lifecycle, microphone, audio playback, conversation state, and mode tracking.

For pre-built UI components, see [`@deepgram/ui`](https://github.com/deepgram/ui).

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
  const { conversation, sendUserMessage } = useAgentConversation();
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

## AgentProvider

Wraps your component tree with agent state management. Creates and manages an `AgentSession`, `AgentMicrophone`, and `AgentPlayer` internally.

```tsx
<AgentProvider
  config={agentSessionConfig}   // Required: AgentSessionConfig
  microphone={true}             // Enable microphone capture (default: true)
  microphoneOptions={{          // MicrophoneOptions
    sampleRate: 16_000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }}
  tts={true}                    // Enable audio playback (default: true)
  playerSampleRate={24_000}     // Agent audio sample rate (default: 24_000)
  autoStart={false}             // Auto-connect on mount (default: false)
  onFunctionCall={handler}      // Fallback function call handler
  onError={handleError}         // Protocol Error notification
  onSdkError={handleSdkError}   // SDK transport or automatic-start failure
  onWarning={handleWarning}     // Protocol Warning notification
  onLatencyReport={handleLatency}
  onInjectionRefused={handleRefusal}
  onListenUpdated={handleListenUpdate}
  onPromptUpdated={handlePromptUpdate}
  onSpeakUpdated={handleSpeakUpdate}
  onThinkUpdated={handleThinkUpdate}
  onHistory={handleHistory}
>
  {children}
</AgentProvider>
```

`config`, `playerSampleRate`, and the initial `autoStart` value establish resources for the provider's lifetime. Changing those props does not reconstruct or automatically restart the session. Use `updateListen`, `updateThink`, `updateSpeak`, and `updatePrompt` for supported mid-session changes; remount the provider when a new session config or player sample rate is required.

`onListenUpdated`, `onPromptUpdated`, `onSpeakUpdated`, and `onThinkUpdated` receive the server confirmations for their matching runtime update methods.

### Mode Tracking

The provider tracks four agent modes: `"idle"`, `"listening"`, `"thinking"`, and `"speaking"`.

`"thinking"` is set only when the server sends `AgentThinking`; text-injected turns may not send that event. `"speaking"` is set when the server sends `AgentStartedSpeaking` and, when `tts={true}`, inferred from incoming agent audio if that event is absent. With `tts={false}`, speaking inference requires the server event. The speaking-to-listening transition is playback-aware: when the server fires `AgentAudioDone`, the provider waits until `AgentPlayer.getRemainingPlaybackTime()` reaches zero before switching to `"listening"`. This prevents premature mode changes while audio is still playing.

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
  start,          // () => Promise<void>; rejects on failure and does not call onSdkError
  stop,           // () => void
} = useAgentState();
```

### useAgentMode

Speaking/listening/thinking mode.

```ts
const {
   mode,        // "idle" | "listening" | "thinking" | "speaking"
   isSpeaking,  // boolean
   isListening, // boolean
   isThinking,  // boolean
} = useAgentMode();
```

### useAgentConversation

Conversation transcript and text messaging.

```ts
const {
  conversation,       // ConversationEntry[] -- { id, role, content, timestamp }
  clearConversation,  // () => void
  sendUserMessage,    // (text: string) => void
  sendAgentMessage,   // (message: string, behavior?: "default" | "queue" | "interrupt") => void
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

Lifecycle, messaging, runtime settings, and mute actions grouped in one hook. Like the other focused hooks, it consumes `AgentContext`, so consumers still re-render when the provider value changes.

```ts
const {
  start,
  stop,
  sendUserMessage,
  sendAgentMessage,
  updateListen,
  updateThink,
  updateSpeak,
  updatePrompt,
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
    const { city } = JSON.parse(fn.arguments);
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

Raw context value (escape hatch). Returns the full `AgentContextValue`. Prefer focused hooks for a smaller, purpose-specific API surface.

### useDeepgramAgent (standalone)

Self-contained hook that does not require `AgentProvider`. Creates and manages its own session, microphone, and player. Useful for simple integrations or when you don't need the provider/context pattern.

The initial `config` and `playerSampleRate` similarly apply for the hook's lifetime. Use the returned update methods for supported runtime settings changes.

`start()` begins a fresh session and clears `conversation`.

The standalone hook accepts the same notification callbacks as `AgentProvider`, including `onListenUpdated`, `onPromptUpdated`, `onSpeakUpdated`, and `onThinkUpdated`.

```ts
const {
  state, mode, micActive, micMuted, outputMuted, conversation,
  start, stop, setMicMuted, setOutputMuted,
  sendUserMessage, sendAgentMessage,
  updateListen, updateThink, updateSpeak, updatePrompt,
  clearConversation, interrupt,
} = useDeepgramAgent({
  config: {
    auth: { tokenFactory: () => fetch('/api/token').then(r => r.text()) },
    agent: { think: { provider: { type: 'open_ai', model: 'gpt-4o-mini' } } },
  },
  onWarning: (message) => console.warn(message),
  onLatencyReport: (report) => console.debug(report),
});
```

## Exports

All hooks, the provider, context types, and common SDK types (re-exported from `@deepgram/agents` for convenience):

```ts
// Provider
export { AgentProvider };
export type { AgentNotificationCallbacks, AgentProviderProps };

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
  AgentSettingsObject, AgentMessageBehavior, ListenSettings,
  ThinkSettings, SpeakSettings, MicrophoneOptions,
  AgentThinkingMessage, ListenUpdatedMessage, PromptUpdatedMessage,
  SpeakUpdatedMessage, ThinkUpdatedMessage, LatencyReportMessage,
  HistoryMessage, InjectionRefusedMessage,
  AgentErrorMessage, AgentWarningMessage,
};
```

## License

MIT
