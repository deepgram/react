import { createContext, useContext } from "react";
import type {
  AgentMessageBehavior,
  AgentSession,
  AgentState,
  FunctionCallItem,
  ListenSettings,
  SpeakSettings,
  ThinkSettings,
} from "@deepgram/agents";

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number; // ms epoch
}

export type AgentMode = "idle" | "listening" | "thinking" | "speaking";

export interface AgentContextValue {
  // Raw session — escape hatch for anything not exposed here
  session: AgentSession;

  // Connection
  state: AgentState;
  start: () => Promise<void>;
  stop: () => void;

  // Mode (speaking / listening / thinking)
  mode: AgentMode;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;

  // Conversation
  conversation: ConversationEntry[];
  clearConversation: () => void;
  sendUserMessage: (text: string) => void;
  sendAgentMessage: (message: string, behavior?: AgentMessageBehavior) => void;

  // Runtime settings
  updateListen: (listen: ListenSettings) => void;
  updateThink: (think: ThinkSettings | ThinkSettings[]) => void;
  updateSpeak: (speak: SpeakSettings | SpeakSettings[]) => void;
  updatePrompt: (prompt: string) => void;

  // Microphone
  micActive: boolean;
  micMuted: boolean;
  setMicMuted: (muted: boolean) => void;
  micEnabled: boolean;

  // Audio playback
  outputMuted: boolean;
  setOutputMuted: (muted: boolean) => void;
  ttsEnabled: boolean;

  // Volume (for visualizers — call these per frame, not per render)
  getInputVolume: () => number;
  getOutputVolume: () => number;

  // Client tools — dynamic registration
  registerClientTool: (name: string, handler: (fn: FunctionCallItem) => Promise<string> | string) => () => void;
  unregisterClientTool: (name: string) => void;
}

export const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgentContext(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgentContext must be used inside <AgentProvider>");
  return ctx;
}
