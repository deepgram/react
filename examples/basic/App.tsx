import {
  AgentProvider,
  useAgentState,
  useAgentConversation,
  useAgentMode,
} from "@deepgram/react";

const config = {
  auth: {
    tokenFactory: () => fetch("/api/deepgram-token").then((r) => r.text()),
  },
  agent: {
    think: { provider: { type: "open_ai" as const, model: "gpt-4o-mini" } },
  },
};

export default function App() {
  return (
    <AgentProvider config={config}>
      <VoiceAgent />
    </AgentProvider>
  );
}

function VoiceAgent() {
  const { state, start, stop } = useAgentState();
  const { conversation, sendUserMessage } = useAgentConversation();
  const { mode } = useAgentMode();
  const handleStart = async () => {
    try {
      await start();
    } catch (error) {
      console.error("Failed to start voice agent", error);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <h1>Deepgram Voice Agent</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <button onClick={state === "idle" ? handleStart : stop}>
          {state === "idle" ? "Start" : "Stop"}
        </button>
        <span>State: {state}</span>
        {mode !== "idle" && <span>Mode: {mode}</span>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.querySelector("input") as HTMLInputElement;
            if (input.value.trim()) {
              sendUserMessage(input.value.trim());
              input.value = "";
            }
          }}
        >
          <input
            type="text"
            placeholder="Type a message..."
            style={{ width: "70%", marginRight: 8 }}
          />
          <button type="submit">Send</button>
        </form>
      </div>

      <div>
        {conversation.map((entry) => (
          <p key={entry.id}>
            <b>{entry.role}:</b> {entry.content}
          </p>
        ))}
      </div>
    </div>
  );
}
