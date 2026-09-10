import { useAgentContext } from "../context.js";
import type {
  AgentMessageBehavior,
  ListenSettings,
  SpeakSettings,
  ThinkSettings,
} from "@deepgram/agents";

export interface UseAgentControlsResult {
  start: () => Promise<void>;
  stop: () => void;
  sendUserMessage: (text: string) => void;
  sendAgentMessage: (message: string, behavior?: AgentMessageBehavior) => void;
  updateListen: (listen: ListenSettings) => void;
  updateThink: (think: ThinkSettings | ThinkSettings[]) => void;
  updateSpeak: (speak: SpeakSettings | SpeakSettings[]) => void;
  updatePrompt: (prompt: string) => void;
  clearConversation: () => void;
  setMicMuted: (muted: boolean) => void;
  setOutputMuted: (muted: boolean) => void;
}

/**
 * Agent action methods grouped for components that trigger controls. This
 * hook consumes AgentContext, so its component still re-renders when the
 * provider value changes.
 */
export function useAgentControls(): UseAgentControlsResult {
  const {
    start,
    stop,
    sendUserMessage,
    sendAgentMessage,
    updateListen,
    updateThink,
    updateSpeak,
    updatePrompt,
    clearConversation,
    setMicMuted,
    setOutputMuted,
  } = useAgentContext();

  return {
    start,
    stop,
    sendUserMessage,
    sendAgentMessage,
    updateListen,
    updateThink,
    updateSpeak,
    updatePrompt,
    clearConversation,
    setMicMuted,
    setOutputMuted,
  };
}
