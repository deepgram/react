// Provider
export { AgentProvider } from "./provider.js";
export type { AgentNotificationCallbacks, AgentProviderProps } from "./provider.js";

// Context (escape hatch)
export { useAgentContext } from "./context.js";
export type { AgentContextValue, ConversationEntry, AgentMode } from "./context.js";

// Focused hooks — convenient API slices backed by AgentContext
export { useAgentState }        from "./hooks/useAgentState.js";
export { useAgentConversation } from "./hooks/useAgentConversation.js";
export { useAgentMicrophone }   from "./hooks/useAgentMicrophone.js";
export { useAgentPlayer }       from "./hooks/useAgentPlayer.js";
export { useAgentSession }      from "./hooks/useAgentSession.js";
export { useAgentMode }         from "./hooks/useAgentMode.js";
export { useAgentControls }     from "./hooks/useAgentControls.js";
export { useAgentClientTool }   from "./hooks/useAgentClientTool.js";
export type { UseAgentStateResult }        from "./hooks/useAgentState.js";
export type { UseAgentConversationResult } from "./hooks/useAgentConversation.js";
export type { UseAgentMicrophoneResult }   from "./hooks/useAgentMicrophone.js";
export type { UseAgentPlayerResult }       from "./hooks/useAgentPlayer.js";
export type { UseAgentModeResult }         from "./hooks/useAgentMode.js";
export type { UseAgentControlsResult }     from "./hooks/useAgentControls.js";

// Standalone hook — no provider needed
export { useDeepgramAgent } from "./hooks/useDeepgramAgent.js";
export type { UseDeepgramAgentResult, UseDeepgramAgentOptions } from "./hooks/useDeepgramAgent.js";

// SDK types re-exported for convenience
export type {
  AgentSessionConfig,
  AuthConfig,
  TokenFactory,
  AgentSettingsObject,
  AgentMessageBehavior,
  ListenSettings,
  ThinkSettings,
  ThinkProvider,
  SpeakSettings,
  SpeakProvider,
  MicrophoneOptions,
  AgentSessionEvents,
  AgentState,
  WelcomeMessage,
  SettingsAppliedMessage,
  ConversationTextMessage,
  UserStartedSpeakingMessage,
  AgentThinkingMessage,
  FunctionCallRequestMessage,
  FunctionCallItem,
  AgentStartedSpeakingMessage,
  AgentAudioDoneMessage,
  PromptUpdatedMessage,
  SpeakUpdatedMessage,
  ThinkUpdatedMessage,
  ListenUpdatedMessage,
  LatencyReportMessage,
  HistoryMessage,
  InjectionRefusedMessage,
  AgentErrorMessage,
  AgentWarningMessage,
  ServerMessage,
} from "@deepgram/agents";
