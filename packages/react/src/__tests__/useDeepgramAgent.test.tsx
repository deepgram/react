import React from "react";
import { beforeEach, describe, expect, it, jest } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  failNextMicrophoneStart,
  lastMicrophone,
  lastPlayer,
  lastSession,
  players,
  resetMocks,
} from "./helpers/mock-sdk.js";

const { useDeepgramAgent } = await import("../hooks/useDeepgramAgent.js");

const config = {
  auth: { apiKey: "test-key" },
  agent: { think: { provider: { type: "open_ai" as const, model: "gpt-4o-mini" } } },
};

describe("useDeepgramAgent", () => {
  beforeEach(resetMocks);

  it("manages a basic session and exposes current controls", async () => {
    const { result } = renderHook(() => useDeepgramAgent({ config }));

    await act(async () => result.current.start());
    expect(result.current.state).toBe("connected");
    expect(result.current.micActive).toBe(true);

    const listen = { provider: { type: "deepgram", model: "flux-general-en" } };
    const think = { provider: { type: "open_ai", model: "gpt-4o" } };
    const speak = { provider: { type: "deepgram", model: "aura-2-thalia-en" } };
    act(() => {
      result.current.sendUserMessage("Hello");
      result.current.sendAgentMessage("Welcome", "queue");
      result.current.updateListen(listen);
      result.current.updateThink(think);
      result.current.updateSpeak(speak);
      result.current.updatePrompt("Be brief");
      lastSession.emit("agent-thinking", { type: "AgentThinking" });
    });

    expect(lastSession.injectUserMessage).toHaveBeenCalledWith("Hello");
    expect(lastSession.injectAgentMessage).toHaveBeenCalledWith("Welcome", "queue");
    expect(lastSession.updateListen).toHaveBeenCalledWith(listen);
    expect(lastSession.updateThink).toHaveBeenCalledWith(think);
    expect(lastSession.updateSpeak).toHaveBeenCalledWith(speak);
    expect(lastSession.updatePrompt).toHaveBeenCalledWith("Be brief");
    expect(result.current.mode).toBe("thinking");
    expect(result.current.isThinking).toBe(true);
  });

  it("uses the latest callbacks without replacing its session", async () => {
    const firstWarning = jest.fn();
    const latestWarning = jest.fn();
    const firstFunction = jest.fn(() => "old");
    const latestFunction = jest.fn(() => "new");
    const { result, rerender } = renderHook(
      ({ warning, fn }) => useDeepgramAgent({
        config,
        onWarning: warning,
        onFunctionCall: fn,
      }),
      { initialProps: { warning: firstWarning, fn: firstFunction } },
    );
    const session = lastSession;

    rerender({ warning: latestWarning, fn: latestFunction });
    act(() => {
      lastSession.emit("warning", { type: "Warning", message: "latest" });
      lastSession.emit("function-call-request", {
        type: "FunctionCallRequest",
        functions: [{ id: "1", name: "lookup", arguments: "{}", client_side: true }],
      });
    });

    await waitFor(() => {
      expect(lastSession.sendFunctionCallResponse).toHaveBeenCalledWith("1", "lookup", "new");
    });
    expect(result.current.state).toBe("idle");
    expect(lastSession).toBe(session);
    expect(firstWarning).not.toHaveBeenCalled();
    expect(latestWarning).toHaveBeenCalledTimes(1);
    expect(firstFunction).not.toHaveBeenCalled();
  });

  it("forwards SDK transport errors", () => {
    const onSdkError = jest.fn();
    renderHook(() => useDeepgramAgent({ config, onSdkError }));
    const error = new Error("socket closed");

    act(() => lastSession.emit("sdk-error", error));

    expect(onSdkError).toHaveBeenCalledWith(error);
  });

  it("forwards runtime setting update notifications", () => {
    const onPromptUpdated = jest.fn();
    const onSpeakUpdated = jest.fn();
    const onThinkUpdated = jest.fn();
    renderHook(() => useDeepgramAgent({
      config,
      onPromptUpdated,
      onSpeakUpdated,
      onThinkUpdated,
    }));
    const prompt = { type: "PromptUpdated" };
    const speak = { type: "SpeakUpdated" };
    const think = { type: "ThinkUpdated" };

    act(() => {
      lastSession.emit("prompt-updated", prompt);
      lastSession.emit("speak-updated", speak);
      lastSession.emit("think-updated", think);
    });

    expect(onPromptUpdated).toHaveBeenCalledWith(prompt);
    expect(onSpeakUpdated).toHaveBeenCalledWith(speak);
    expect(onThinkUpdated).toHaveBeenCalledWith(think);
  });

  it("rolls back cleanly when microphone startup fails", async () => {
    const failure = new Error("microphone unavailable");
    failNextMicrophoneStart(failure);
    const { result } = renderHook(() => useDeepgramAgent({ config }));

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.start();
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(failure);
    expect(lastMicrophone.stop).toHaveBeenCalled();
    expect(lastSession.disconnect).toHaveBeenCalled();
    expect(lastPlayer.interrupt).toHaveBeenCalled();
    expect(result.current.micActive).toBe(false);
    expect(result.current.micMuted).toBe(false);
    expect(result.current.mode).toBe("idle");
  });

  it("stop interrupts queued playback and clears mic/mode state", async () => {
    const { result } = renderHook(() => useDeepgramAgent({ config }));
    await act(async () => result.current.start());
    act(() => {
      result.current.setMicMuted(true);
      lastSession.emit("audio", new ArrayBuffer(32));
    });
    lastPlayer.interrupt.mockClear();

    act(() => result.current.stop());

    expect(lastPlayer.interrupt).toHaveBeenCalledTimes(1);
    expect(lastMicrophone.stop).toHaveBeenCalled();
    expect(result.current.micActive).toBe(false);
    expect(result.current.micMuted).toBe(false);
    expect(result.current.mode).toBe("idle");
  });

  it("starts again after a pending start is canceled", async () => {
    const { result } = renderHook(() => useDeepgramAgent({ config }));
    let resolveFirstConnect!: () => void;
    lastSession.connect.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveFirstConnect = resolve; }),
    );
    let firstStart!: Promise<void>;
    act(() => { firstStart = result.current.start(); });
    act(() => result.current.stop());

    await act(async () => result.current.start());
    expect(lastSession.connect).toHaveBeenCalledTimes(2);
    expect(result.current.micActive).toBe(true);
    const disconnectCalls = lastSession.disconnect.mock.calls.length;

    await act(async () => {
      resolveFirstConnect();
      await firstStart;
    });
    expect(lastSession.disconnect).toHaveBeenCalledTimes(disconnectCalls);
    expect(result.current.micActive).toBe(true);
  });

  it("stops audio resources after a terminal disconnect", async () => {
    const { result } = renderHook(() => useDeepgramAgent({ config }));
    await act(async () => result.current.start());
    act(() => result.current.setMicMuted(true));
    lastMicrophone.stop.mockClear();
    lastPlayer.interrupt.mockClear();

    act(() => {
      lastSession.state = "disconnected";
      lastSession.emit("disconnected", "reconnect attempts exhausted");
    });

    expect(lastMicrophone.stop).toHaveBeenCalledTimes(1);
    expect(lastPlayer.interrupt).toHaveBeenCalledTimes(1);
    expect(result.current.micActive).toBe(false);
    expect(result.current.micMuted).toBe(false);
    expect(result.current.mode).toBe("idle");
  });

  it("does not send a client-tool result through a replacement session", async () => {
    let resolveTool!: (result: string) => void;
    const onFunctionCall = jest.fn(
      () => new Promise<string>((resolve) => { resolveTool = resolve; }),
    );
    const { result } = renderHook(() => useDeepgramAgent({ config, onFunctionCall }));
    await act(async () => result.current.start());

    act(() => {
      lastSession.emit("function-call-request", {
        type: "FunctionCallRequest",
        functions: [{ id: "old-call", name: "lookup", arguments: "{}", client_side: true }],
      });
    });
    act(() => result.current.stop());
    await act(async () => result.current.start());

    await act(async () => {
      resolveTool("old-result");
      await Promise.resolve();
    });
    expect(lastSession.sendFunctionCallResponse).not.toHaveBeenCalled();
  });

  it("does not reuse a disposed player during StrictMode replay", async () => {
    const StrictWrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>{children}</React.StrictMode>
    );
    const { unmount } = renderHook(() => useDeepgramAgent({ config }), {
      wrapper: StrictWrapper,
    });

    expect(players).toHaveLength(1);
    expect(lastPlayer.disposed).toBe(false);
    act(() => lastSession.emit("audio", new ArrayBuffer(32)));
    expect(lastPlayer.queue).toHaveBeenCalled();

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(lastSession.disconnect).toHaveBeenCalled();
    expect(lastPlayer.dispose).toHaveBeenCalledTimes(1);
    expect(players.every((player) => player.dispose.mock.calls.length === 1)).toBe(true);
  });
});
