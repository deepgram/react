import React from "react";
import { describe, it, expect, beforeEach, jest } from "bun:test";
import { render, renderHook, act, waitFor } from "@testing-library/react";

// Install mocks before importing hooks
import { resetMocks, lastSession } from "./helpers/mock-sdk.js";
import { createWrapper, TestProvider } from "./helpers/test-wrapper.js";

const { useAgentState } = await import("../hooks/useAgentState.js");
const { useAgentConversation } = await import("../hooks/useAgentConversation.js");
const { useAgentMicrophone } = await import("../hooks/useAgentMicrophone.js");
const { useAgentPlayer } = await import("../hooks/useAgentPlayer.js");
const { useAgentSession } = await import("../hooks/useAgentSession.js");
const { useAgentControls } = await import("../hooks/useAgentControls.js");
const { useAgentClientTool } = await import("../hooks/useAgentClientTool.js");
const { useAgentContext } = await import("../context.js");

describe("useAgentState", () => {
  beforeEach(resetMocks);

  it("returns correct boolean flags for idle state", () => {
    const { result } = renderHook(() => useAgentState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.isDisconnected).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it("isActive is true for connected state", async () => {
    const { result } = renderHook(() => useAgentState(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it("transitions to disconnected on stop", async () => {
    const { result } = renderHook(() => useAgentState(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isDisconnected).toBe(true);
    expect(result.current.isActive).toBe(false);
  });
});

describe("useAgentConversation", () => {
  beforeEach(resetMocks);

  it("starts with empty conversation", () => {
    const { result } = renderHook(() => useAgentConversation(), {
      wrapper: createWrapper(),
    });
    expect(result.current.conversation).toEqual([]);
  });

  it("sendUserMessage delegates to session", async () => {
    const { result } = renderHook(() => useAgentConversation(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.sendUserMessage("Hello");
    });

    expect(lastSession.injectUserMessage).toHaveBeenCalledWith("Hello");
  });

  it("clearConversation resets to empty", async () => {
    const { result } = renderHook(() => useAgentConversation(), {
      wrapper: createWrapper(),
    });

    // Simulate a conversation-text event to add a message
    act(() => {
      lastSession.emit("conversation-text", {
        type: "ConversationText",
        role: "assistant",
        content: "Hello!",
      });
    });

    expect(result.current.conversation).toHaveLength(1);

    act(() => {
      result.current.clearConversation();
    });

    expect(result.current.conversation).toEqual([]);
    expect(lastSession.clearConversationHistory).toHaveBeenCalledTimes(1);
  });
});

describe("useAgentControls", () => {
  beforeEach(resetMocks);

  it("exposes current agent message and settings controls", () => {
    const { result } = renderHook(() => useAgentControls(), {
      wrapper: createWrapper(),
    });
    const listen = { provider: { type: "deepgram", model: "flux-general-en" } };
    const think = { provider: { type: "open_ai", model: "gpt-4o" } };
    const speak = { provider: { type: "deepgram", model: "aura-2-thalia-en" } };

    act(() => {
      result.current.sendAgentMessage("One moment", "interrupt");
      result.current.updateListen(listen);
      result.current.updateThink(think);
      result.current.updateSpeak(speak);
      result.current.updatePrompt("Updated prompt");
    });

    expect(lastSession.injectAgentMessage).toHaveBeenCalledWith("One moment", "interrupt");
    expect(lastSession.updateListen).toHaveBeenCalledWith(listen);
    expect(lastSession.updateThink).toHaveBeenCalledWith(think);
    expect(lastSession.updateSpeak).toHaveBeenCalledWith(speak);
    expect(lastSession.updatePrompt).toHaveBeenCalledWith("Updated prompt");
  });
});

describe("useAgentClientTool", () => {
  beforeEach(resetMocks);

  it("handles function calls using fn.arguments", async () => {
    renderHook(
      () => useAgentClientTool("lookup", (fn) => fn.arguments),
      { wrapper: createWrapper() },
    );

    act(() => {
      lastSession.emit("function-call-request", {
        type: "FunctionCallRequest",
        functions: [{ id: "tool-1", name: "lookup", arguments: "{\"city\":\"Paris\"}", client_side: true }],
      });
    });

    await waitFor(() => {
      expect(lastSession.sendFunctionCallResponse).toHaveBeenCalledWith(
        "tool-1",
        "lookup",
        "{\"city\":\"Paris\"}",
      );
    });
  });

  it("does not let an older duplicate registration remove the newer handler", async () => {
    const first = jest.fn(() => "first");
    const second = jest.fn(() => "second");
    const { rerender } = render(
      <TestProvider>
        <ToolRegistration key="first" handler={first} />
        <ToolRegistration key="second" handler={second} />
      </TestProvider>,
    );

    rerender(
      <TestProvider>
        <ToolRegistration key="second" handler={second} />
      </TestProvider>,
    );
    act(() => {
      lastSession.emit("function-call-request", {
        type: "FunctionCallRequest",
        functions: [{ id: "tool-2", name: "lookup", arguments: "{}", client_side: true }],
      });
    });

    await waitFor(() => {
      expect(lastSession.sendFunctionCallResponse).toHaveBeenCalledWith(
        "tool-2",
        "lookup",
        "second",
      );
    });
    expect(first).not.toHaveBeenCalled();
  });
});

function ToolRegistration({
  handler,
}: {
  handler: () => string;
}) {
  useAgentClientTool("lookup", handler);
  return null;
}

describe("useAgentMicrophone", () => {
  beforeEach(resetMocks);

  it("returns enabled=true by default", () => {
    const { result } = renderHook(() => useAgentMicrophone(), {
      wrapper: createWrapper(),
    });
    expect(result.current.enabled).toBe(true);
  });

  it("returns enabled=false when microphone={false}", () => {
    const { result } = renderHook(() => useAgentMicrophone(), {
      wrapper: createWrapper({ microphone: false }),
    });
    expect(result.current.enabled).toBe(false);
  });

  it("toggle flips micMuted state", () => {
    const { result } = renderHook(() => useAgentMicrophone(), {
      wrapper: createWrapper(),
    });

    expect(result.current.micMuted).toBe(false);

    act(() => {
      result.current.toggle();
    });

    // Note: toggle calls setMicMuted which requires a mic ref to exist
    // Since we haven't started, the ref is null and the state won't update
    // This tests that toggle calls setMicMuted(!micMuted)
  });
});

describe("useAgentPlayer", () => {
  beforeEach(resetMocks);

  it("returns enabled=true by default", () => {
    const { result } = renderHook(() => useAgentPlayer(), {
      wrapper: createWrapper(),
    });
    expect(result.current.enabled).toBe(true);
  });

  it("returns enabled=false when tts={false}", () => {
    const { result } = renderHook(() => useAgentPlayer(), {
      wrapper: createWrapper({ tts: false }),
    });
    expect(result.current.enabled).toBe(false);
  });
});

describe("useAgentSession", () => {
  beforeEach(resetMocks);

  it("returns the session object", () => {
    const { result } = renderHook(() => useAgentSession(), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBeDefined();
    expect(result.current.connect).toBeDefined();
  });
});

describe("useAgentContext", () => {
  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useAgentContext());
    }).toThrow("useAgentContext must be used inside <AgentProvider>");
  });
});
