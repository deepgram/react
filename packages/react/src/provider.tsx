import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { AgentContext, type AgentMode, type ConversationEntry } from "./context.js";

export interface AgentNotificationCallbacks {
  onError?: (message: AgentErrorMessage) => void;
  onSdkError?: (error: Error) => void;
  onWarning?: (message: AgentWarningMessage) => void;
  onLatencyReport?: (message: LatencyReportMessage) => void;
  onInjectionRefused?: (message: InjectionRefusedMessage) => void;
  onListenUpdated?: (message: ListenUpdatedMessage) => void;
  onPromptUpdated?: (message: PromptUpdatedMessage) => void;
  onSpeakUpdated?: (message: SpeakUpdatedMessage) => void;
  onThinkUpdated?: (message: ThinkUpdatedMessage) => void;
  onHistory?: (message: HistoryMessage) => void;
}

export interface AgentProviderProps extends AgentNotificationCallbacks {
  config: AgentSessionConfig;
  microphone?: boolean;
  microphoneOptions?: MicrophoneOptions;
  tts?: boolean;
  playerSampleRate?: number;
  autoStart?: boolean;
  onFunctionCall?: (fn: FunctionCallItem) => Promise<string> | string;
  children?: ReactNode;
}

let _idSeq = 0;
const nextId = () => String(++_idSeq);

export function AgentProvider({
  config,
  microphone = true,
  microphoneOptions,
  tts = true,
  playerSampleRate = 24_000,
  autoStart = false,
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
  children,
}: AgentProviderProps) {
  const sessionRef = useRef<AgentSession | null>(null);
  const micRef = useRef<AgentMicrophone | null>(null);
  const playerRef = useRef<AgentPlayer | null>(null);

  if (!sessionRef.current) sessionRef.current = new AgentSession(config);

  const latestPropsRef = useRef({
    microphone,
    microphoneOptions,
    tts,
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
  latestPropsRef.current = {
    microphone,
    microphoneOptions,
    tts,
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

  const clientToolsRef = useRef<Map<string, Array<{
    id: symbol;
    handler: (fn: FunctionCallItem) => Promise<string> | string;
  }>>>(new Map());
  const audioDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectCycleRef = useRef(0);
  const mountedRef = useRef(true);
  const initialPlayerSampleRateRef = useRef(playerSampleRate);
  const initialAutoStartRef = useRef(autoStart);
  const autoStartRequestedRef = useRef(false);
  const startGenerationRef = useRef(0);
  const microphoneGenerationRef = useRef(0);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const startInProgressGenerationRef = useRef<number | null>(null);
  const microphoneStartPromiseRef = useRef<Promise<void> | null>(null);

  const [state, setState] = useState<AgentState>("idle");
  const [mode, setMode] = useState<AgentMode>("idle");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [micMuted, setMicMutedState] = useState(false);
  const [outputMuted, setOutputMutedState] = useState(false);

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

  const startMicrophone = useCallback(function ensureMicrophone(
    session: AgentSession,
  ): Promise<void> {
    if (
      !latestPropsRef.current.microphone
      || session.state !== "connected"
    ) {
      return Promise.resolve();
    }
    if (micRef.current && !microphoneStartPromiseRef.current) {
      return Promise.resolve();
    }
    const inFlight = microphoneStartPromiseRef.current;
    if (inFlight) {
      return inFlight.then(() => ensureMicrophone(session));
    }

    const generation = ++microphoneGenerationRef.current;
    const mic = new AgentMicrophone(
      (data) => session.sendAudio(data),
      latestPropsRef.current.microphoneOptions,
    );
    micRef.current = mic;

    const promise = (async () => {
      try {
        await mic.start();
      } catch (error) {
        mic.stop();
        if (micRef.current === mic) micRef.current = null;
        if (
          generation !== microphoneGenerationRef.current
          || !latestPropsRef.current.microphone
        ) {
          return;
        }
        throw error;
      }

      if (
        generation !== microphoneGenerationRef.current
        || !latestPropsRef.current.microphone
        || micRef.current !== mic
      ) {
        mic.stop();
        if (micRef.current === mic) micRef.current = null;
        return;
      }

      if (mountedRef.current) {
        setMicActive(true);
        setMicMutedState(false);
      }
    })();

    microphoneStartPromiseRef.current = promise;
    void promise.then(
      () => {
        if (microphoneStartPromiseRef.current === promise) {
          microphoneStartPromiseRef.current = null;
        }
      },
      () => {
        if (microphoneStartPromiseRef.current === promise) {
          microphoneStartPromiseRef.current = null;
        }
      },
    );
    return promise.then(() => ensureMicrophone(session));
  }, []);

  const start = useCallback((): Promise<void> => {
    if (startPromiseRef.current) return startPromiseRef.current;

    const session = requireSession(sessionRef.current);
    const generation = ++startGenerationRef.current;
    startInProgressGenerationRef.current = generation;
    const { tts: ttsEnabled } = latestPropsRef.current;

    clearAudioDoneTimer();
    (ttsEnabled ? ensurePlayer() : playerRef.current)?.interrupt();
    ++microphoneGenerationRef.current;
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

        await startMicrophone(session);
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
        if (startInProgressGenerationRef.current === generation) {
          startInProgressGenerationRef.current = null;
        }
      },
      () => {
        if (startPromiseRef.current === promise) startPromiseRef.current = null;
        if (startInProgressGenerationRef.current === generation) {
          startInProgressGenerationRef.current = null;
        }
      },
    );
    return promise;
  }, [clearAudioDoneTimer, ensurePlayer, startMicrophone]);

  const stop = useCallback(() => {
    ++startGenerationRef.current;
    startPromiseRef.current = null;
    startInProgressGenerationRef.current = null;
    clearAudioDoneTimer();
    sessionRef.current?.disconnect();
  }, [clearAudioDoneTimer]);

  const setMicMuted = useCallback((muted: boolean) => {
    if (!micRef.current) return;
    muted ? micRef.current.mute() : micRef.current.unmute();
    setMicMutedState(muted);
  }, []);

  const setOutputMuted = useCallback((muted: boolean) => {
    const player = playerRef.current ?? (
      latestPropsRef.current.tts ? ensurePlayer() : null
    );
    if (!player) return;
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

  const reportAutomaticStartError = useCallback((error: unknown) => {
    const sdkError = error instanceof Error ? error : new Error(String(error));
    const callback = latestPropsRef.current.onSdkError;
    if (callback) callback(sdkError);
    else console.error(sdkError);
  }, []);

  const registerClientTool = useCallback((
    name: string,
    handler: (fn: FunctionCallItem) => Promise<string> | string,
  ) => {
    const registration = { id: Symbol(name), handler };
    const registrations = clientToolsRef.current.get(name) ?? [];
    registrations.push(registration);
    clientToolsRef.current.set(name, registrations);

    return () => {
      const current = clientToolsRef.current.get(name);
      if (!current) return;
      const index = current.findIndex(({ id }) => id === registration.id);
      if (index !== -1) current.splice(index, 1);
      if (current.length === 0) clientToolsRef.current.delete(name);
    };
  }, []);

  const unregisterClientTool = useCallback((name: string) => {
    clientToolsRef.current.delete(name);
  }, []);

  const getInputVolume = useCallback(
    () => micRef.current?.getInputVolume() ?? 0,
    [],
  );
  const getOutputVolume = useCallback(
    () => playerRef.current?.getOutputVolume() ?? 0,
    [],
  );

  useEffect(() => {
    if (tts) {
      ensurePlayer();
      return;
    }

    const wasWaitingForPlayback = audioDoneTimerRef.current !== null;
    clearAudioDoneTimer();
    playerRef.current?.interrupt();
    if (wasWaitingForPlayback) setMode("listening");
  }, [clearAudioDoneTimer, ensurePlayer, tts]);

  useEffect(() => {
    if (!microphone) {
      ++microphoneGenerationRef.current;
      micRef.current?.stop();
      micRef.current = null;
      setMicActive(false);
      setMicMutedState(false);
      return;
    }

    const session = sessionRef.current;
    if (session?.state === "connected" && !micRef.current) {
      void startMicrophone(session).catch(reportAutomaticStartError);
    }
  }, [microphone, reportAutomaticStartError, startMicrophone]);

  useEffect(() => {
    const session = requireSession(sessionRef.current);
    const cycle = ++effectCycleRef.current;
    mountedRef.current = true;

    const onState = () => setState(session.state);
    const onConnected = () => {
      onState();
      if (startInProgressGenerationRef.current !== null) return;
      void startMicrophone(session).catch(reportAutomaticStartError);
    };
    const onDisconnected = () => {
      ++startGenerationRef.current;
      ++microphoneGenerationRef.current;
      startPromiseRef.current = null;
      startInProgressGenerationRef.current = null;
      onState();
      clearAudioDoneTimer();
      micRef.current?.stop();
      micRef.current = null;
      playerRef.current?.interrupt();
      setMicActive(false);
      setMicMutedState(false);
      setMode("idle");
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
    const onUserStartedSpeaking = () => {
      clearAudioDoneTimer();
      setMode("listening");
      playerRef.current?.interrupt();
    };
    const onSettingsApplied = () => setMode("listening");
    const onAgentThinking = () => {
      clearAudioDoneTimer();
      setMode("thinking");
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
      if (!latestPropsRef.current.tts) return;
      setMode("speaking");
      ensurePlayer().queue(chunk);
    };
    const onFunctionCallRequest = async (msg: FunctionCallRequestMessage) => {
      const generation = startGenerationRef.current;
      for (const fn of msg.functions) {
        if (generation !== startGenerationRef.current) return;
        if (!fn.client_side) continue;
        const registrations = clientToolsRef.current.get(fn.name);
        const handler = registrations?.[registrations.length - 1]?.handler
          ?? latestPropsRef.current.onFunctionCall;
        if (!handler) continue;
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
    const onProtocolError = (message: AgentErrorMessage) => latestPropsRef.current.onError?.(message);
    const onSdkError = (error: Error) => latestPropsRef.current.onSdkError?.(error);
    const onProtocolWarning = (message: AgentWarningMessage) => latestPropsRef.current.onWarning?.(message);
    const onLatency = (message: LatencyReportMessage) => latestPropsRef.current.onLatencyReport?.(message);
    const onRefused = (message: InjectionRefusedMessage) => latestPropsRef.current.onInjectionRefused?.(message);
    const onListen = (message: ListenUpdatedMessage) => latestPropsRef.current.onListenUpdated?.(message);
    const onPrompt = (message: PromptUpdatedMessage) => latestPropsRef.current.onPromptUpdated?.(message);
    const onSpeak = (message: SpeakUpdatedMessage) => latestPropsRef.current.onSpeakUpdated?.(message);
    const onThink = (message: ThinkUpdatedMessage) => latestPropsRef.current.onThinkUpdated?.(message);
    const onHistoryMessage = (message: HistoryMessage) => latestPropsRef.current.onHistory?.(message);

    session.on("connecting", onState);
    session.on("connected", onConnected);
    session.on("reconnecting", onState);
    session.on("disconnected", onDisconnected);
    session.on("agent-started-speaking", onAgentStartedSpeaking);
    session.on("agent-audio-done", onAgentAudioDone);
    session.on("user-started-speaking", onUserStartedSpeaking);
    session.on("settings-applied", onSettingsApplied);
    session.on("agent-thinking", onAgentThinking);
    session.on("conversation-text", onConversationText);
    session.on("audio", onAudio);
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

    if (initialAutoStartRef.current) {
      queueMicrotask(() => {
        if (
          mountedRef.current &&
          effectCycleRef.current === cycle &&
          !autoStartRequestedRef.current
        ) {
          autoStartRequestedRef.current = true;
          start().catch(reportAutomaticStartError);
        }
      });
    }

    return () => {
      mountedRef.current = false;
      ++startGenerationRef.current;
      ++microphoneGenerationRef.current;
      startPromiseRef.current = null;
      startInProgressGenerationRef.current = null;
      clearAudioDoneTimer();

      session.off("connecting", onState);
      session.off("connected", onConnected);
      session.off("reconnecting", onState);
      session.off("disconnected", onDisconnected);
      session.off("agent-started-speaking", onAgentStartedSpeaking);
      session.off("agent-audio-done", onAgentAudioDone);
      session.off("user-started-speaking", onUserStartedSpeaking);
      session.off("settings-applied", onSettingsApplied);
      session.off("agent-thinking", onAgentThinking);
      session.off("conversation-text", onConversationText);
      session.off("audio", onAudio);
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

      // StrictMode immediately replays effects. Delay final resource disposal so
      // the next setup can retain the live session/player, while real unmounts
      // still release everything in the following microtask.
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
  }, [clearAudioDoneTimer, ensurePlayer, reportAutomaticStartError, start, startMicrophone]);

  return (
    <AgentContext.Provider
      value={{
        session: sessionRef.current,
        state,
        mode,
        isSpeaking: mode === "speaking",
        isListening: mode === "listening",
        isThinking: mode === "thinking",
        start,
        stop,
        conversation,
        clearConversation,
        sendUserMessage,
        sendAgentMessage,
        updateListen,
        updateThink,
        updateSpeak,
        updatePrompt,
        micActive,
        micMuted,
        setMicMuted,
        micEnabled: microphone,
        outputMuted,
        setOutputMuted,
        ttsEnabled: tts,
        getInputVolume,
        getOutputVolume,
        registerClientTool,
        unregisterClientTool,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

function requireSession(session: AgentSession | null): AgentSession {
  if (!session) throw new Error("Agent session is unavailable");
  return session;
}
