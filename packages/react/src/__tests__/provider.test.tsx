import React from "react";
import { describe, it, expect, beforeEach, jest } from "bun:test";
import { render, act, waitFor } from "@testing-library/react";

import {
  deferNextMicrophoneStart,
  failNextMicrophoneStart,
  lastMicrophone,
  lastPlayer,
  lastSession,
  microphones,
  players,
  resetMocks,
  sessions,
} from "./helpers/mock-sdk.js";
import { TestProvider } from "./helpers/test-wrapper.js";

const { useAgentState } = await import("../hooks/useAgentState.js");
const { useAgentConversation } = await import("../hooks/useAgentConversation.js");
const { useAgentContext } = await import("../context.js");

// Helper component to extract context values
function StateReader({ onState }: { onState: (s: ReturnType<typeof useAgentState>) => void }) {
  const state = useAgentState();
  onState(state);
  return null;
}

function ConversationReader({ onConversation }: { onConversation: (c: ReturnType<typeof useAgentConversation>) => void }) {
  const conv = useAgentConversation();
  onConversation(conv);
  return null;
}

describe("AgentProvider", () => {
  beforeEach(resetMocks);

  describe("session creation", () => {
    it("creates an AgentSession on mount", () => {
      render(
        <TestProvider>
          <div />
        </TestProvider>,
      );
      expect(lastSession).toBeDefined();
      expect(lastSession.connect).toBeDefined();
    });

    it("creates an AgentPlayer when tts={true}", () => {
      render(
        <TestProvider tts={true}>
          <div />
        </TestProvider>,
      );
      expect(lastPlayer).toBeDefined();
    });

    it("does not create an AgentPlayer when tts={false}", () => {
      render(
        <TestProvider tts={false}>
          <div />
        </TestProvider>,
      );
      expect(lastPlayer).toBeUndefined();
    });
  });

  describe("state events", () => {
    it("updates state on session events", () => {
      let currentState: ReturnType<typeof useAgentState> | undefined;
      render(
        <TestProvider microphone={false}>
          <StateReader onState={(s) => { currentState = s; }} />
        </TestProvider>,
      );

      expect(currentState!.state).toBe("idle");

      act(() => {
        lastSession.state = "connecting";
        lastSession.emit("connecting");
      });
      expect(currentState!.state).toBe("connecting");

      act(() => {
        lastSession.state = "connected";
        lastSession.emit("connected");
      });
      expect(currentState!.state).toBe("connected");
    });

    it("updates state on disconnected event", () => {
      let currentState: ReturnType<typeof useAgentState> | undefined;
      render(
        <TestProvider>
          <StateReader onState={(s) => { currentState = s; }} />
        </TestProvider>,
      );

      act(() => {
        lastSession.state = "disconnected";
        lastSession.emit("disconnected", "test");
      });
      expect(currentState!.state).toBe("disconnected");
    });
  });

  describe("conversation events", () => {
    it("appends messages on conversation-text events", () => {
      let conv: ReturnType<typeof useAgentConversation> | undefined;
      render(
        <TestProvider>
          <ConversationReader onConversation={(c) => { conv = c; }} />
        </TestProvider>,
      );

      expect(conv!.conversation).toHaveLength(0);

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

      act(() => {
        lastSession.emit("conversation-text", {
          type: "ConversationText",
          role: "user",
          content: "Hi there",
        });
      });

      expect(conv!.conversation).toHaveLength(2);
    });
  });

  describe("audio routing", () => {
    it("queues audio to player on audio events", () => {
      render(
        <TestProvider>
          <div />
        </TestProvider>,
      );

      const audioData = new ArrayBuffer(480);
      act(() => {
        lastSession.emit("audio", audioData);
      });

      expect(lastPlayer.queue).toHaveBeenCalledWith(audioData);
    });

    it("interrupts player on user-started-speaking", () => {
      render(
        <TestProvider>
          <div />
        </TestProvider>,
      );

      act(() => {
        lastSession.emit("user-started-speaking", {
          type: "UserStartedSpeaking",
        });
      });

      expect(lastPlayer.interrupt).toHaveBeenCalled();
    });

    it("does not queue audio when tts={false}", () => {
      render(
        <TestProvider tts={false}>
          <div />
        </TestProvider>,
      );

      act(() => {
        lastSession.emit("audio", new ArrayBuffer(480));
      });

      // No player was created, so queue was never called
      expect(lastPlayer).toBeUndefined();
    });
  });

  describe("lifecycle", () => {
    it("start() calls session.connect()", async () => {
      let currentState: ReturnType<typeof useAgentState> | undefined;
      render(
        <TestProvider>
          <StateReader onState={(s) => { currentState = s; }} />
        </TestProvider>,
      );

      await act(async () => {
        await currentState!.start();
      });

      expect(lastSession.connect).toHaveBeenCalled();
    });

    it("stop() calls session.disconnect()", async () => {
      let currentState: ReturnType<typeof useAgentState> | undefined;
      render(
        <TestProvider>
          <StateReader onState={(s) => { currentState = s; }} />
        </TestProvider>,
      );

      await act(async () => {
        await currentState!.start();
      });

      act(() => {
        currentState!.stop();
      });

      expect(lastSession.disconnect).toHaveBeenCalled();
    });

    it("start() creates and starts microphone when microphone={true}", async () => {
      let currentState: ReturnType<typeof useAgentState> | undefined;
      render(
        <TestProvider microphone={true}>
          <StateReader onState={(s) => { currentState = s; }} />
        </TestProvider>,
      );

      await act(async () => {
        await currentState!.start();
      });

      expect(lastMicrophone).toBeDefined();
      expect(lastMicrophone.start).toHaveBeenCalled();
    });

    it("start() does not create microphone when microphone={false}", async () => {
      let currentState: ReturnType<typeof useAgentState> | undefined;
      render(
        <TestProvider microphone={false}>
          <StateReader onState={(s) => { currentState = s; }} />
        </TestProvider>,
      );

      await act(async () => {
        await currentState!.start();
      });

      expect(lastMicrophone).toBeUndefined();
    });

    it("cleanup on unmount removes owned listeners and disposes", async () => {
      const { unmount } = render(
        <TestProvider>
          <div />
        </TestProvider>,
      );

      await act(async () => {
        unmount();
        await Promise.resolve();
      });

      expect(lastSession.eventNames()).toHaveLength(0);
      expect(lastSession.disconnect).toHaveBeenCalled();
      expect(lastPlayer.dispose).toHaveBeenCalled();
    });
  });

  describe("sendUserMessage", () => {
    it("delegates to session.injectUserMessage", () => {
      let conv: ReturnType<typeof useAgentConversation> | undefined;
      render(
        <TestProvider>
          <ConversationReader onConversation={(c) => { conv = c; }} />
        </TestProvider>,
      );

      act(() => {
        conv!.sendUserMessage("Hello agent");
      });

      expect(lastSession.injectUserMessage).toHaveBeenCalledWith("Hello agent");
    });

    it("delegates agent messages and runtime setting updates", () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      const listen = { provider: { type: "deepgram", model: "flux-general-en" } };
      const think = { provider: { type: "open_ai", model: "gpt-4o" } };
      const speak = { provider: { type: "deepgram", model: "aura-2-thalia-en" } };

      act(() => {
        context!.sendAgentMessage("Please wait", "queue");
        context!.updateListen(listen);
        context!.updateThink(think);
        context!.updateSpeak(speak);
        context!.updatePrompt("Be concise");
      });

      expect(lastSession.injectAgentMessage).toHaveBeenCalledWith("Please wait", "queue");
      expect(lastSession.updateListen).toHaveBeenCalledWith(listen);
      expect(lastSession.updateThink).toHaveBeenCalledWith(think);
      expect(lastSession.updateSpeak).toHaveBeenCalledWith(speak);
      expect(lastSession.updatePrompt).toHaveBeenCalledWith("Be concise");
    });

    it("delegates conversation clearing to AgentSession", () => {
      let conversation: ReturnType<typeof useAgentConversation> | undefined;
      render(
        <TestProvider>
          <ConversationReader onConversation={(value) => { conversation = value; }} />
        </TestProvider>,
      );

      act(() => conversation!.clearConversation());

      expect(lastSession.clearConversationHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe("notifications and function tools", () => {
    it("forwards protocol notifications to typed callbacks", () => {
      const callbacks = {
        onError: jest.fn(),
        onSdkError: jest.fn(),
        onWarning: jest.fn(),
        onLatencyReport: jest.fn(),
        onInjectionRefused: jest.fn(),
        onListenUpdated: jest.fn(),
        onPromptUpdated: jest.fn(),
        onSpeakUpdated: jest.fn(),
        onThinkUpdated: jest.fn(),
        onHistory: jest.fn(),
      };
      render(<TestProvider {...callbacks}><div /></TestProvider>);

      const messages = {
        error: { type: "Error", message: "bad" },
        sdkError: new Error("socket closed"),
        warning: { type: "Warning", message: "careful" },
        latency: { type: "LatencyReport", total_latency: 10 },
        refused: { type: "InjectionRefused", message: "busy" },
        listen: { type: "ListenUpdated" },
        prompt: { type: "PromptUpdated" },
        speak: { type: "SpeakUpdated" },
        think: { type: "ThinkUpdated" },
        history: { type: "History", role: "assistant", content: "hello" },
      };
      act(() => {
        lastSession.emit("error", messages.error);
        lastSession.emit("sdk-error", messages.sdkError);
        lastSession.emit("warning", messages.warning);
        lastSession.emit("latency-report", messages.latency);
        lastSession.emit("injection-refused", messages.refused);
        lastSession.emit("listen-updated", messages.listen);
        lastSession.emit("prompt-updated", messages.prompt);
        lastSession.emit("speak-updated", messages.speak);
        lastSession.emit("think-updated", messages.think);
        lastSession.emit("history", messages.history);
      });

      expect(callbacks.onError).toHaveBeenCalledWith(messages.error);
      expect(callbacks.onSdkError).toHaveBeenCalledWith(messages.sdkError);
      expect(callbacks.onWarning).toHaveBeenCalledWith(messages.warning);
      expect(callbacks.onLatencyReport).toHaveBeenCalledWith(messages.latency);
      expect(callbacks.onInjectionRefused).toHaveBeenCalledWith(messages.refused);
      expect(callbacks.onListenUpdated).toHaveBeenCalledWith(messages.listen);
      expect(callbacks.onPromptUpdated).toHaveBeenCalledWith(messages.prompt);
      expect(callbacks.onSpeakUpdated).toHaveBeenCalledWith(messages.speak);
      expect(callbacks.onThinkUpdated).toHaveBeenCalledWith(messages.think);
      expect(callbacks.onHistory).toHaveBeenCalledWith(messages.history);
    });

    it("uses the latest notification and function-call props without replacing the session", async () => {
      const firstWarning = jest.fn();
      const latestWarning = jest.fn();
      const firstFunction = jest.fn(() => "old");
      const latestFunction = jest.fn(() => "new");
      const { rerender } = render(
        <TestProvider onWarning={firstWarning} onFunctionCall={firstFunction}><div /></TestProvider>,
      );
      const session = lastSession;

      rerender(
        <TestProvider onWarning={latestWarning} onFunctionCall={latestFunction}><div /></TestProvider>,
      );
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
      expect(lastSession).toBe(session);
      expect(firstWarning).not.toHaveBeenCalled();
      expect(latestWarning).toHaveBeenCalledTimes(1);
      expect(firstFunction).not.toHaveBeenCalled();
      expect(latestFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe("mode and lifecycle safety", () => {
    it("tracks AgentThinking before switching to playback-aware speaking", () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      act(() => lastSession.emit("agent-thinking", { type: "AgentThinking" }));
      expect(context!.mode).toBe("thinking");
      expect(context!.isThinking).toBe(true);

      act(() => lastSession.emit("audio", new ArrayBuffer(32)));
      expect(context!.mode).toBe("speaking");
      expect(context!.isSpeaking).toBe(true);
    });

    it("waits for queued playback before returning to listening", async () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      lastPlayer.getRemainingPlaybackTime.mockReturnValue(0.01);

      act(() => {
        lastSession.emit("audio", new ArrayBuffer(32));
        lastSession.emit("agent-audio-done", { type: "AgentAudioDone" });
      });
      expect(context!.mode).toBe("speaking");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(context!.mode).toBe("listening");
    });

    it("rolls back the session when microphone startup fails", async () => {
      const failure = new Error("permission denied");
      failNextMicrophoneStart(failure);
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      let thrown: unknown;
      await act(async () => {
        try {
          await context!.start();
        } catch (error) {
          thrown = error;
        }
      });

      expect(thrown).toBe(failure);
      expect(lastMicrophone.stop).toHaveBeenCalled();
      expect(lastSession.disconnect).toHaveBeenCalled();
      expect(context!.micActive).toBe(false);
      expect(context!.micMuted).toBe(false);
      expect(context!.mode).toBe("idle");
    });

    it("stop interrupts playback and resets mic and mode state for restart", async () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      await act(async () => context!.start());
      act(() => {
        context!.setMicMuted(true);
        lastSession.emit("audio", new ArrayBuffer(32));
      });
      lastPlayer.interrupt.mockClear();

      act(() => context!.stop());

      expect(lastPlayer.interrupt).toHaveBeenCalledTimes(1);
      expect(context!.micActive).toBe(false);
      expect(context!.micMuted).toBe(false);
      expect(context!.mode).toBe("idle");

      await act(async () => context!.start());
      expect(microphones).toHaveLength(2);
      expect(context!.micActive).toBe(true);
      expect(context!.micMuted).toBe(false);
    });

    it("starts again after a pending start is canceled", async () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      let resolveFirstConnect!: () => void;
      lastSession.connect.mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveFirstConnect = resolve; }),
      );
      let firstStart!: Promise<void>;
      act(() => { firstStart = context!.start(); });
      act(() => context!.stop());

      await act(async () => context!.start());
      expect(lastSession.connect).toHaveBeenCalledTimes(2);
      expect(microphones).toHaveLength(1);
      expect(context!.micActive).toBe(true);
      const disconnectCalls = lastSession.disconnect.mock.calls.length;

      await act(async () => {
        resolveFirstConnect();
        await firstStart;
      });
      expect(lastSession.disconnect).toHaveBeenCalledTimes(disconnectCalls);
      expect(context!.micActive).toBe(true);
    });

    it("stops audio resources after a terminal disconnect", async () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      await act(async () => context!.start());
      act(() => context!.setMicMuted(true));
      lastMicrophone.stop.mockClear();
      lastPlayer.interrupt.mockClear();

      act(() => {
        lastSession.state = "disconnected";
        lastSession.emit("disconnected", "reconnect attempts exhausted");
      });

      expect(lastMicrophone.stop).toHaveBeenCalledTimes(1);
      expect(lastPlayer.interrupt).toHaveBeenCalledTimes(1);
      expect(context!.micActive).toBe(false);
      expect(context!.micMuted).toBe(false);
      expect(context!.mode).toBe("idle");
    });

    it("stops active resources when microphone and TTS are disabled", async () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      const { rerender } = render(
        <TestProvider microphone tts>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      await act(async () => context!.start());
      act(() => {
        context!.setMicMuted(true);
        lastSession.emit("audio", new ArrayBuffer(32));
      });
      lastMicrophone.stop.mockClear();
      lastPlayer.interrupt.mockClear();

      rerender(
        <TestProvider microphone={false} tts={false}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      expect(lastMicrophone.stop).toHaveBeenCalledTimes(1);
      expect(lastPlayer.interrupt).toHaveBeenCalledTimes(1);
      expect(context!.micEnabled).toBe(false);
      expect(context!.ttsEnabled).toBe(false);
      expect(context!.micActive).toBe(false);
      expect(context!.micMuted).toBe(false);

      rerender(
        <TestProvider microphone tts={false}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      await waitFor(() => expect(microphones).toHaveLength(2));
      expect(context!.micEnabled).toBe(true);
      expect(context!.micActive).toBe(true);
    });

    it("ignores a canceled microphone startup failure", async () => {
      const deferred = deferNextMicrophoneStart();
      let context: ReturnType<typeof useAgentContext> | undefined;
      const { rerender } = render(
        <TestProvider microphone>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      let startPromise!: Promise<void>;
      act(() => { startPromise = context!.start(); });
      await waitFor(() => expect(microphones).toHaveLength(1));

      rerender(
        <TestProvider microphone={false}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      deferred.reject(new Error("permission denied after cancellation"));
      await act(async () => startPromise);

      expect(lastSession.disconnect).not.toHaveBeenCalled();
      expect(context!.state).toBe("connected");
      expect(context!.micEnabled).toBe(false);
      expect(context!.micActive).toBe(false);
    });

    it("shares microphone startup when re-enabled before connect resolves", async () => {
      const microphoneStart = deferNextMicrophoneStart();
      let resolveConnect!: () => void;
      let context: ReturnType<typeof useAgentContext> | undefined;
      const { rerender } = render(
        <TestProvider microphone={false}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      lastSession.connect.mockImplementationOnce(async () => {
        lastSession.state = "connected";
        lastSession.emit("connecting");
        lastSession.emit("connected");
        await new Promise<void>((resolve) => { resolveConnect = resolve; });
      });
      let startPromise!: Promise<void>;
      act(() => { startPromise = context!.start(); });

      rerender(
        <TestProvider microphone>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      await waitFor(() => expect(microphones).toHaveLength(1));
      act(() => resolveConnect());
      microphoneStart.resolve();
      await act(async () => startPromise);

      expect(microphones).toHaveLength(1);
      expect(lastMicrophone.start).toHaveBeenCalledTimes(1);
      expect(lastMicrophone.stop).not.toHaveBeenCalled();
      expect(context!.micActive).toBe(true);
    });

    it("waits for a canceled microphone attempt before re-enabling", async () => {
      const firstMicrophoneStart = deferNextMicrophoneStart();
      let context: ReturnType<typeof useAgentContext> | undefined;
      const { rerender } = render(
        <TestProvider microphone>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      let startPromise!: Promise<void>;
      act(() => { startPromise = context!.start(); });
      await waitFor(() => expect(microphones).toHaveLength(1));

      rerender(
        <TestProvider microphone={false}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      rerender(
        <TestProvider microphone>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      expect(microphones).toHaveLength(1);

      firstMicrophoneStart.resolve();
      await act(async () => startPromise);

      expect(microphones).toHaveLength(2);
      expect(microphones[0].stop).toHaveBeenCalled();
      expect(microphones[1].start).toHaveBeenCalledTimes(1);
      expect(context!.micActive).toBe(true);
    });

    it("reports automatic microphone failures without onSdkError", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      try {
        let context: ReturnType<typeof useAgentContext> | undefined;
        const { rerender } = render(
          <TestProvider microphone={false}>
            <ContextReader onContext={(value) => { context = value; }} />
          </TestProvider>,
        );
        await act(async () => context!.start());

        const reEnableFailure = new Error("microphone access denied on re-enable");
        failNextMicrophoneStart(reEnableFailure);
        rerender(
          <TestProvider microphone>
            <ContextReader onContext={(value) => { context = value; }} />
          </TestProvider>,
        );
        await waitFor(() => expect(consoleError).toHaveBeenCalledWith(reEnableFailure));

        const reconnectFailure = new Error("microphone access denied on reconnect");
        failNextMicrophoneStart(reconnectFailure);
        act(() => {
          lastSession.state = "reconnecting";
          lastSession.emit("reconnecting", 1, 100);
          lastSession.state = "connected";
          lastSession.emit("connected");
        });
        await waitFor(() => expect(consoleError).toHaveBeenCalledWith(reconnectFailure));
        expect(consoleError).toHaveBeenCalledTimes(2);
      } finally {
        consoleError.mockRestore();
      }
    });

    it("starts an enabled microphone when reconnect reaches connected", async () => {
      let context: ReturnType<typeof useAgentContext> | undefined;
      const { rerender } = render(
        <TestProvider microphone>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      await act(async () => context!.start());

      rerender(
        <TestProvider microphone={false}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      act(() => {
        lastSession.state = "reconnecting";
        lastSession.emit("reconnecting", 1, 100);
      });
      rerender(
        <TestProvider microphone>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      expect(microphones).toHaveLength(1);

      act(() => {
        lastSession.state = "connected";
        lastSession.emit("connected");
      });
      await waitFor(() => expect(context!.micActive).toBe(true));

      expect(microphones[1].start).toHaveBeenCalledTimes(1);
    });

    it("does not send a client-tool result through a replacement session", async () => {
      let resolveTool!: (result: string) => void;
      const onFunctionCall = jest.fn(
        () => new Promise<string>((resolve) => { resolveTool = resolve; }),
      );
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider onFunctionCall={onFunctionCall}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );
      await act(async () => context!.start());

      act(() => {
        lastSession.emit("function-call-request", {
          type: "FunctionCallRequest",
          functions: [{ id: "old-call", name: "lookup", arguments: "{}", client_side: true }],
        });
      });
      act(() => context!.stop());
      await act(async () => context!.start());

      await act(async () => {
        resolveTool("old-result");
        await Promise.resolve();
      });
      expect(lastSession.sendFunctionCallResponse).not.toHaveBeenCalled();
    });

    it("forwards auto-start microphone failures to onSdkError", async () => {
      const onSdkError = jest.fn();
      const failure = new Error("microphone access denied");
      failNextMicrophoneStart(failure);
      let context: ReturnType<typeof useAgentContext> | undefined;
      render(
        <TestProvider autoStart onSdkError={onSdkError}>
          <ContextReader onContext={(value) => { context = value; }} />
        </TestProvider>,
      );

      await waitFor(() => {
        expect(onSdkError).toHaveBeenCalledWith(failure);
      });
      expect(onSdkError).toHaveBeenCalledTimes(1);
      expect(context!.state).toBe("disconnected");
      expect(context!.micActive).toBe(false);
      expect(context!.mode).toBe("idle");
    });

    it("survives StrictMode replay without duplicate auto-start or disposed-player reuse", async () => {
      const { unmount } = render(
        <React.StrictMode>
          <TestProvider autoStart><div /></TestProvider>
        </React.StrictMode>,
      );

      await waitFor(() => {
        expect(sessions.reduce((count, session) => count + session.connect.mock.calls.length, 0)).toBe(1);
      });
      expect(microphones).toHaveLength(1);
      expect(players).toHaveLength(1);
      expect(lastPlayer.disposed).toBe(false);

      act(() => lastSession.emit("audio", new ArrayBuffer(32)));
      expect(lastPlayer.queue).toHaveBeenCalled();

      const externalWarningListener = jest.fn();
      lastSession.on("warning", externalWarningListener);
      await act(async () => {
        unmount();
        await Promise.resolve();
      });

      expect(lastPlayer.dispose).toHaveBeenCalledTimes(1);
      expect(players.every((player) => player.dispose.mock.calls.length === 1)).toBe(true);
      expect(lastMicrophone.stop).toHaveBeenCalled();
      expect(lastSession.listenerCount("warning")).toBe(1);
      lastSession.off("warning", externalWarningListener);
    });
  });
});

function ContextReader({
  onContext,
}: {
  onContext: (context: ReturnType<typeof useAgentContext>) => void;
}) {
  onContext(useAgentContext());
  return null;
}
