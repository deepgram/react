# Migration Guide

## 0.1 to 0.2

`@deepgram/react` 0.2.0 adds runtime Voice Agent controls and updates the package for `@deepgram/agents` 0.1.2 and `@deepgram/sdk` 5.9.0.

Install the new release:

```bash
npm install @deepgram/react@^0.2.0
```

### Handle the `thinking` mode

`AgentMode` now includes `"thinking"`. Update exhaustive mode switches and any mode-to-label maps.

```ts
switch (mode) {
  case "idle":
  case "listening":
  case "thinking":
  case "speaking":
    break;
}
```

### Update typed context and hook wrappers

`AgentContextValue` and hook result types now include required members for the new controls and state. Components that consume the hooks do not need a source change, but typed mocks, wrappers, and objects that implement these interfaces must provide the new members.

### Keep the client-tool unsubscribe function

`registerClientTool()` now returns an unsubscribe function. Existing calls that ignore its return value still work. Store and call the result when registering outside a component lifecycle:

```tsx
import { useAgentContext } from "@deepgram/react";

function MapControls() {
  const { registerClientTool } = useAgentContext();
  const unregister = registerClientTool("get_location", () => {
    return JSON.stringify({ latitude: 0, longitude: 0 });
  });

  // Later, when the handler is no longer needed:
  unregister();
}
```

`useAgentClientTool()` remains the preferred option inside React components and unregisters automatically on unmount.

### Treat standalone `start()` as a fresh session

`useDeepgramAgent().start()` now clears `conversation` before connecting. Keep any transcript that must survive a restart outside the hook, or restore it after the new session starts.

Manual `start()` calls reject on failure. Handle the returned promise:

```tsx
import { useAgentControls } from "@deepgram/react";

function ConnectButton() {
  const { start } = useAgentControls();

  async function handleStart() {
    try {
      await start();
    } catch (error) {
      console.error("Failed to start the Voice Agent", error);
    }
  }

  return <button onClick={handleStart}>Connect</button>;
}
```

Automatic start failures, including microphone failures during auto-start and reconnect, call `onSdkError` when it is provided.

### Use the new runtime controls

Use the controls from `useAgentControls()`, `useAgentConversation()`, or `useDeepgramAgent()` to update a connected agent without recreating the provider:

```tsx
import { useAgentControls } from "@deepgram/react";

function TakeoverButton() {
  const { sendAgentMessage, updatePrompt } = useAgentControls();

  function takeOver() {
    updatePrompt("Keep responses concise.");
    sendAgentMessage("I will take it from here.", "interrupt");
  }

  return <button onClick={takeOver}>Take over</button>;
}
```

Use `onListenUpdated`, `onPromptUpdated`, `onSpeakUpdated`, and `onThinkUpdated` on `AgentProvider` or `useDeepgramAgent()` to observe the matching server confirmation.

See the [package README](packages/react/README.md) for the complete API surface.
