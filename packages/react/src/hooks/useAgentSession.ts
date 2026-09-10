import { useAgentContext } from "../context.js";
import type { AgentSession } from "@deepgram/agents";

/**
 * Returns the raw AgentSession for advanced use cases — custom event
 * listeners and sendFunctionCallResponse.
 */
export function useAgentSession(): AgentSession {
  return useAgentContext().session;
}
