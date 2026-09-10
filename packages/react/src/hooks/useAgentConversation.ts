import { useAgentContext, type ConversationEntry } from "../context.js";
import type { AgentMessageBehavior } from "@deepgram/agents";

export interface UseAgentConversationResult {
  conversation: ConversationEntry[];
  clearConversation: () => void;
  sendUserMessage: (text: string) => void;
  sendAgentMessage: (message: string, behavior?: AgentMessageBehavior) => void;
}

/** Conversation history and text messaging. */
export function useAgentConversation(): UseAgentConversationResult {
  const { conversation, clearConversation, sendUserMessage, sendAgentMessage } = useAgentContext();
  return { conversation, clearConversation, sendUserMessage, sendAgentMessage };
}
