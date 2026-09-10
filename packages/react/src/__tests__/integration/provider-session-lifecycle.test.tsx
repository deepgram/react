import React from "react";
import { describe, it, expect, beforeEach } from "bun:test";
import { render, act } from "@testing-library/react";

import { resetMocks, lastSession, lastPlayer, lastMicrophone } from "../helpers/mock-sdk.js";
import { TestProvider } from "../helpers/test-wrapper.js";

const { useAgentState } = await import("../../hooks/useAgentState.js");
const { useAgentConversation } = await import("../../hooks/useAgentConversation.js");

function StateReader({ onState }: { onState: (s: ReturnType<typeof useAgentState>) => void }) {
  onState(useAgentState());
  return null;
}

function ConversationReader({ onConv }: { onConv: (c: ReturnType<typeof useAgentConversation>) => void }) {
  onConv(useAgentConversation());
  return null;
}

describe("Integration: Provider ↔ Session lifecycle", () => {
  beforeEach(resetMocks);

  it("full lifecycle: mount → start → events → stop → unmount", async () => {
    let state: ReturnType<typeof useAgentState> | undefined;
    let conv: ReturnType<typeof useAgentConversation> | undefined;

    const { unmount } = render(
      <TestProvider>
        <StateReader onState={(s) => { state = s; }} />
        <ConversationReader onConv={(c) => { conv = c; }} />
      </TestProvider>,
    );

    // 1. Initial state
    expect(state!.state).toBe("idle");
    expect(conv!.conversation).toHaveLength(0);

    // 2. Start session
    await act(async () => {
      await state!.start();
    });
    expect(state!.isConnected).toBe(true);
    expect(lastSession.connect).toHaveBeenCalled();
    expect(lastMicrophone).toBeDefined();
    expect(lastMicrophone.start).toHaveBeenCalled();

    // 3. Receive conversation events
    act(() => {
      lastSession.emit("conversation-text", {
        type: "ConversationText",
        role: "assistant",
        content: "Hello!",
      });
    });
    expect(conv!.conversation).toHaveLength(1);
    expect(conv!.conversation[0].role).toBe("assistant");
    expect(conv!.conversation[0].content).toBe("Hello!");

    // 4. Receive audio → routed to player
    const audioData = new ArrayBuffer(480);
    act(() => {
      lastSession.emit("audio", audioData);
    });
    expect(lastPlayer.queue).toHaveBeenCalledWith(audioData);

    // 5. User started speaking → player interrupted
    act(() => {
      lastSession.emit("user-started-speaking", { type: "UserStartedSpeaking" });
    });
    expect(lastPlayer.interrupt).toHaveBeenCalled();

    // 6. Stop session
    act(() => {
      state!.stop();
    });
    expect(lastSession.disconnect).toHaveBeenCalled();

    // 7. Unmount → full cleanup
    await act(async () => {
      unmount();
      await Promise.resolve();
    });
    expect(lastSession.eventNames()).toHaveLength(0);
    expect(lastPlayer.dispose).toHaveBeenCalled();
  });

  it("conversation accumulates multiple messages correctly", async () => {
    let conv: ReturnType<typeof useAgentConversation> | undefined;

    render(
      <TestProvider>
        <ConversationReader onConv={(c) => { conv = c; }} />
      </TestProvider>,
    );

    act(() => {
      lastSession.emit("conversation-text", {
        type: "ConversationText",
        role: "user",
        content: "Hello",
      });
      lastSession.emit("conversation-text", {
        type: "ConversationText",
        role: "assistant",
        content: "Hi!",
      });
      lastSession.emit("conversation-text", {
        type: "ConversationText",
        role: "user",
        content: "How are you?",
      });
    });

    expect(conv!.conversation).toHaveLength(3);
    expect(conv!.conversation[0].role).toBe("user");
    expect(conv!.conversation[1].role).toBe("assistant");
    expect(conv!.conversation[2].role).toBe("user");

    // Clear
    act(() => {
      conv!.clearConversation();
    });
    expect(conv!.conversation).toHaveLength(0);
  });
});
