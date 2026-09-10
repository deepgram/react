# Changelog

## [0.2.0](https://github.com/deepgram/react/compare/react-v0.1.0...react-v0.2.0) (2026-09-10)


### ⚠ BREAKING CHANGES

* **react:** `AgentMode` now includes `"thinking"`.
* **react:** Public context and hook result types add required members for the new agent controls and state.
* **react:** `registerClientTool()` now returns an unsubscribe function.
* **react:** `useDeepgramAgent().start()` begins a fresh session and clears `conversation`.

### Features

* **react:** Add `"thinking"` mode and `isThinking` state.
* **react:** Add `sendAgentMessage()` with `"default"`, `"queue"`, and `"interrupt"` behavior.
* **react:** Add `updateListen()`, `updateThink()`, `updateSpeak()`, and `updatePrompt()` for runtime agent settings changes.
* **react:** Add typed callbacks for protocol notifications, including settings update confirmations.
* **react:** Expose the new controls and state through `AgentProvider`, focused hooks, and `useDeepgramAgent`.


### Bug Fixes

* **react:** Harden starts, stops, reconnects, and StrictMode replay so canceled or failed sessions cannot retain stale microphone, playback, or client-tool resources.
* **react:** Report automatic start failures, including microphone failures during auto-start and reconnect, through `onSdkError` or `console.error` when no callback is set. Manual `start()` rejects instead.
* **react:** Publish portable declarations that resolve agent types from `@deepgram/agents` in consumer projects.

## 0.1.0 (2026-04-30)


### Features

* initial @deepgram/react package ([c89b63d](https://github.com/deepgram/react/commit/c89b63d813cf4ef65b6dc86e2ca1031bc8c70fe5))


### Refactors

* code review fixes — delete orphaned styles.css, fix ConversationEntry type, export missing types ([85f6d66](https://github.com/deepgram/react/commit/85f6d66258c1603b11ba5128c0a7b2ea39070ac8))
