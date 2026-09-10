# Basic Example

Minimal `AgentProvider` + `useAgentState` + `useAgentConversation` example.

## Prerequisites

- A Deepgram API key (get one at [console.deepgram.com](https://console.deepgram.com))
- A token endpoint at `/api/deepgram-token` that returns a short-lived Deepgram token

## Usage

This example is a standalone React component. To use it in your project:

1. Copy `App.tsx` into your React app
2. Update the `tokenFactory` to point to your token endpoint
3. Render `<App />` in your root component

## What it demonstrates

- Wrapping your app with `AgentProvider`
- Using `useAgentState` for connection lifecycle (`start`/`stop`)
- Using `useAgentConversation` for transcript display and text messaging
- Using `useAgentMode` for listening, thinking, and speaking mode tracking
