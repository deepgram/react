import { useAgentContext, type AgentMode } from "../context.js";

export interface UseAgentModeResult {
  mode: AgentMode;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
}

/**
 * Agent speaking/listening/thinking mode.
 * - `"idle"` — not connected
 * - `"listening"` — agent is listening for user speech
 * - `"thinking"` — agent is preparing a response
 * - `"speaking"` — agent is producing audio
 */
export function useAgentMode(): UseAgentModeResult {
  const { mode, isSpeaking, isListening, isThinking } = useAgentContext();
  return { mode, isSpeaking, isListening, isThinking };
}
