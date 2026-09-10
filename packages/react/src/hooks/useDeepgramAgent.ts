import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentSession,
  AgentMicrophone,
  AgentPlayer,
  type AgentErrorMessage,
  type AgentMessageBehavior,
  type AgentSessionConfig,
  type AgentState,
  type AgentWarningMessage,
  type ConversationTextMessage,
  type FunctionCallItem,
  type FunctionCallRequestMessage,
  type HistoryMessage,
  type InjectionRefusedMessage,
  type LatencyReportMessage,
  type ListenSettings,
  type ListenUpdatedMessage,
  type MicrophoneOptions,
  type PromptUpdatedMessage,
  type SpeakSettings,
  type SpeakUpdatedMessage,
  type ThinkSettings,
  type ThinkUpdatedMessage,
} from "@deepgram/agents";
import type { AgentMode, ConversationEntry } from "../context.js";
import type { AgentNotificationCallbacks } from "../provider.js";

export interface UseDeepgramAgentOptions extends AgentNotificationCallbacks {
  config: AgentSessionConfig;
  micOptions?: MicrophoneOptions;
  playerSampleRate?: number;
  /** Return the client-side function result as a JSON-serialized string. */
  onFunctionCall?: (fn: FunctionCallItem) => Promise<string> | string;
}

export interface UseDeepgramAgentResult {
  state: AgentState;
  mode: AgentMode;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  micActive: boolean;
  micMuted: boolean;
  outputMuted: boolean;
  conversation: ConversationEntry[];
  start: () => Promise<void>;
  stop: () => void;
  setMicMuted: (muted: boolean) => void;
  setOutputMuted: (muted: boolean) => void;
  sendUserMessage: (text: string) => void;
  sendAgentMessage: (message: string, behavior?: AgentMessageBehavior) => void;
  updateListen: (listen: ListenSettings) => void;
  updateThink: (think: ThinkSettings | ThinkSettings[]) => void;
  updateSpeak: (speak: SpeakSettings | SpeakSettings[]) => void;
  updatePrompt: (prompt: string) => void;
  clearConversation: () => void;
  interrupt: () => void;
}

let entryCounter = 0;
const nextId = () => String(++entryCounter);

/**
 * All-in-one hook for a Deepgram Voice Agent session.
 *
 * Suitable for a single widget. Use AgentProvider when multiple components
 * need to share the same session.
 */
export function useDeepgramAgent({
  config,
  micOptions,
  playerSampleRate = 24_000,
  onFunctionCall,
  onError,
  onSdkError,
  onWarning,
  onLatencyReport,
  onInjectionRefused,
  onListenUpdated,
  onPromptUpdated,
  onSpeakUpdated,
  onThinkUpdated,
  onHistory,
}: UseDeepgramAgentOptions): UseDeepgramAgentResult {
  const sessionRef = useRef<AgentSession | null>(null);
  const micRef = useRef<AgentMicrophone | null>(null);
  const playerRef = useRef<AgentPlayer | null>(null);

  if (!sessionRef.current) sessionRef.current = new AgentSession(config);

  const latestOptionsRef = useRef({
    micOptions,
    onFunctionCall,
    onError,
    onSdkError,
    onWarning,
    onLatencyReport,
    onInjectionRefused,
    onListenUpdated,
    onPromptUpdated,
    onSpeakUpdated,
    onThinkUpdated,
    onHistory,
  });
  latestOptionsRef.current = {
    micOptions,
    onFunctionCall,
    onError,
    onSdkError,
    onWarning,
    onLatencyReport,
    onInjectionRefused,
    onListenUpdated,
    onPromptUpdated,
    onSpeakUpdated,
    onThinkUpdated,
    onHistory,
  };

  const audioDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectCycleRef = useRef(0);
  const mountedRef = useRef(true);
  const initialPlayerSampleRateRef = useRef(playerSampleRate);
  const startGenerationRef = useRef(0);
  const startPromiseRef = useRef<Promise<void> | null>(null);

  const [state, setState] = useState<AgentState>("idle");
  const [mode, setMode] = useState<AgentMode>("idle");
  const [micActive, setMicActive] = useState(false);
  const [micMuted, setMicMutedState] = useState(false);
  const [outputMuted, setOutputMutedState] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);

  const ensurePlayer = useCallback((): AgentPlayer => {
    if (!playerRef.current) {
      playerRef.current = new AgentPlayer({
        sampleRate: initialPlayerSampleRateRef.current,
      });
    }
    return playerRef.current;
  }, []);

  const clearAudioDoneTimer = useCallback(() => {
    if (audioDoneTimerRef.current) {
      clearTimeout(audioDoneTimerRef.current);
      audioDoneTimerRef.current = null;
    }
  }, []);

  const start = useCallback((): Promise<void> => {
    if (startPromiseRef.current) return startPromiseRef.current;

    const session = requireSession(sessionRef.current);
    const generation = ++startGenerationRef.current;

    clearAudioDoneTimer();
    ensurePlayer().interrupt();
    micRef.current?.stop();
    micRef.current = null;
    setMicActive(false);
    setMicMutedState(false);
    setConversation([]);

    const promise = (async () => {
      try {
        await session.connect();

        if (generation !== startGenerationRef.current) {
          return;
        }

        const mic = new AgentMicrophone(
          (data) => session.sendAudio(data),
          latestOptionsRef.current.micOptions,
        );
        micRef.current = mic;

        try {
          await mic.start();
        } catch (error) {
          mic.stop();
          if (micRef.current === mic) micRef.current = null;
          throw error;
        }

        if (generation !== startGenerationRef.current) {
          mic.stop();
          if (micRef.current === mic) micRef.current = null;
          return;
        }

        if (mountedRef.current) {
          setMicActive(true);
          setMicMutedState(false);
        }
      } catch (error) {
        if (generation !== startGenerationRef.current) return;
        session.disconnect();
        playerRef.current?.interrupt();
        if (mountedRef.current) {
          setMicActive(false);
          setMicMutedState(false);
          setMode("idle");
        }
        throw error;
      }
    })();

    startPromiseRef.current = promise;
    void promise.then(
      () => {
        if (startPromiseRef.current === promise) startPromiseRef.current = null;
      },
      () => {
        if (startPromiseRef.current === promise) startPromiseRef.current = null;
      },
    );
    return promise;
  }, [clearAudioDoneTimer, ensurePlayer]);

  const stop = useCallback(() => {
    ++startGenerationRef.current;
    startPromiseRef.current = null;
    clearAudioDoneTimer();
    sessionRef.current?.disconnect();
  }, [clearAudioDoneTimer]);

  const setMicMuted = useCallback((muted: boolean) => {
    if (!micRef.current) return;
    muted ? micRef.current.mute() : micRef.current.unmute();
    setMicMutedState(muted);
  }, []);

  const setOutputMuted = useCallback((muted: boolean) => {
    const player = ensurePlayer();
    muted ? player.mute() : player.unmute();
    setOutputMutedState(muted);
  }, [ensurePlayer]);

  const sendUserMessage = useCallback((text: string) => {
    sessionRef.current?.injectUserMessage(text);
  }, []);

  const sendAgentMessage = useCallback((message: string, behavior?: AgentMessageBehavior) => {
    sessionRef.current?.injectAgentMessage(message, behavior);
  }, []);

  const updateListen = useCallback((listen: ListenSettings) => {
    sessionRef.current?.updateListen(listen);
  }, []);

  const updateThink = useCallback((think: ThinkSettings | ThinkSettings[]) => {
    sessionRef.current?.updateThink(think);
  }, []);

  const updateSpeak = useCallback((speak: SpeakSettings | SpeakSettings[]) => {
    sessionRef.current?.updateSpeak(speak);
  }, []);

  const updatePrompt = useCallback((prompt: string) => {
    sessionRef.current?.updatePrompt(prompt);
  }, []);

  const clearConversation = useCallback(() => {
    sessionRef.current?.clearConversationHistory();
    setConversation([]);
  }, []);

  const interrupt = useCallback(() => {
    playerRef.current?.interrupt();
  }, []);

  useEffect(() => {
    const session = requireSession(sessionRef.current);
    const cycle = ++effectCycleRef.current;
    mountedRef.current = true;
    ensurePlayer();

    const onState = () => setState(session.state);
    const onDisconnected = () => {
      ++startGenerationRef.current;
      startPromiseRef.current = null;
      onState();
      clearAudioDoneTimer();
      micRef.current?.stop();
      micRef.current = null;
      playerRef.current?.interrupt();
      setMicActive(false);
      setMicMutedState(false);
      setMode("idle");
    };
    const onConversationText = (msg: ConversationTextMessage) => {
      setConversation((previous) => [
        ...previous,
        {
          id: nextId(),
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: Date.now(),
        },
      ]);
    };
    const onAudio = (chunk: ArrayBuffer) => {
      setMode("speaking");
      ensurePlayer().queue(chunk);
    };
    const onUserStartedSpeaking = () => {
      clearAudioDoneTimer();
      setMode("listening");
      playerRef.current?.interrupt();
    };
    const onAgentStartedSpeaking = () => {
      clearAudioDoneTimer();
      setMode("speaking");
    };
    const onAgentAudioDone = () => {
      const remaining = playerRef.current?.getRemainingPlaybackTime() ?? 0;
      clearAudioDoneTimer();
      audioDoneTimerRef.current = setTimeout(() => {
        audioDoneTimerRef.current = null;
        setMode("listening");
      }, remaining * 1000);
    };
    const onAgentThinking = () => {
      clearAudioDoneTimer();
      setMode("thinking");
    };
    const onSettingsApplied = () => setMode("listening");
    const onFunctionCallRequest = async (msg: FunctionCallRequestMessage) => {
      const handler = latestOptionsRef.current.onFunctionCall;
      if (!handler) return;
      const generation = startGenerationRef.current;
      for (const fn of msg.functions) {
        if (generation !== startGenerationRef.current) return;
        if (!fn.client_side) continue;
        try {
          const result = await handler(fn);
          if (generation !== startGenerationRef.current) return;
          session.sendFunctionCallResponse(fn.id, fn.name, result);
        } catch (error) {
          if (generation !== startGenerationRef.current) return;
          session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ error: String(error) }));
        }
      }
    };
    const onProtocolError = (message: AgentErrorMessage) => latestOptionsRef.current.onError?.(message);
    const onSdkError = (error: Error) => latestOptionsRef.current.onSdkError?.(error);
    const onProtocolWarning = (message: AgentWarningMessage) => latestOptionsRef.current.onWarning?.(message);
    const onLatency = (message: LatencyReportMessage) => latestOptionsRef.current.onLatencyReport?.(message);
    const onRefused = (message: InjectionRefusedMessage) => latestOptionsRef.current.onInjectionRefused?.(message);
    const onListen = (message: ListenUpdatedMessage) => latestOptionsRef.current.onListenUpdated?.(message);
    const onPrompt = (message: PromptUpdatedMessage) => latestOptionsRef.current.onPromptUpdated?.(message);
    const onSpeak = (message: SpeakUpdatedMessage) => latestOptionsRef.current.onSpeakUpdated?.(message);
    const onThink = (message: ThinkUpdatedMessage) => latestOptionsRef.current.onThinkUpdated?.(message);
    const onHistoryMessage = (message: HistoryMessage) => latestOptionsRef.current.onHistory?.(message);

    session.on("connecting", onState);
    session.on("connected", onState);
    session.on("reconnecting", onState);
    session.on("disconnected", onDisconnected);
    session.on("conversation-text", onConversationText);
    session.on("audio", onAudio);
    session.on("user-started-speaking", onUserStartedSpeaking);
    session.on("agent-started-speaking", onAgentStartedSpeaking);
    session.on("agent-audio-done", onAgentAudioDone);
    session.on("agent-thinking", onAgentThinking);
    session.on("settings-applied", onSettingsApplied);
    session.on("function-call-request", onFunctionCallRequest);
    session.on("error", onProtocolError);
    session.on("sdk-error", onSdkError);
    session.on("warning", onProtocolWarning);
    session.on("latency-report", onLatency);
    session.on("injection-refused", onRefused);
    session.on("listen-updated", onListen);
    session.on("prompt-updated", onPrompt);
    session.on("speak-updated", onSpeak);
    session.on("think-updated", onThink);
    session.on("history", onHistoryMessage);

    return () => {
      mountedRef.current = false;
      ++startGenerationRef.current;
      startPromiseRef.current = null;
      clearAudioDoneTimer();

      session.off("connecting", onState);
      session.off("connected", onState);
      session.off("reconnecting", onState);
      session.off("disconnected", onDisconnected);
      session.off("conversation-text", onConversationText);
      session.off("audio", onAudio);
      session.off("user-started-speaking", onUserStartedSpeaking);
      session.off("agent-started-speaking", onAgentStartedSpeaking);
      session.off("agent-audio-done", onAgentAudioDone);
      session.off("agent-thinking", onAgentThinking);
      session.off("settings-applied", onSettingsApplied);
      session.off("function-call-request", onFunctionCallRequest);
      session.off("error", onProtocolError);
      session.off("sdk-error", onSdkError);
      session.off("warning", onProtocolWarning);
      session.off("latency-report", onLatency);
      session.off("injection-refused", onRefused);
      session.off("listen-updated", onListen);
      session.off("prompt-updated", onPrompt);
      session.off("speak-updated", onSpeak);
      session.off("think-updated", onThink);
      session.off("history", onHistoryMessage);

      queueMicrotask(() => {
        if (mountedRef.current || effectCycleRef.current !== cycle) return;
        session.disconnect();
        micRef.current?.stop();
        micRef.current = null;
        playerRef.current?.interrupt();
        playerRef.current?.dispose();
        playerRef.current = null;
      });
    };
  }, [clearAudioDoneTimer, ensurePlayer]);

  return {
    state,
    mode,
    isSpeaking: mode === "speaking",
    isListening: mode === "listening",
    isThinking: mode === "thinking",
    micActive,
    micMuted,
    outputMuted,
    conversation,
    start,
    stop,
    setMicMuted,
    setOutputMuted,
    sendUserMessage,
    sendAgentMessage,
    updateListen,
    updateThink,
    updateSpeak,
    updatePrompt,
    clearConversation,
    interrupt,
  };
}

function requireSession(session: AgentSession | null): AgentSession {
  if (!session) throw new Error("Agent session is unavailable");
  return session;
}
