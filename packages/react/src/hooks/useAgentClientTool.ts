import { useEffect } from "react";
import { useAgentContext } from "../context.js";
import type { FunctionCallItem } from "@deepgram/agents";

/**
 * Register a client-side tool handler that the agent can invoke.
 * Automatically unregisters when the component unmounts.
 *
 * Uses the latest closure — no stale state issues.
 *
 * @example
 * ```tsx
 * function MapComponent() {
 *   const [location, setLocation] = useState({ lat: 0, lng: 0 });
 *
 *   useAgentClientTool("getLocation", () => {
 *     return JSON.stringify(location);
 *   });
 *
 *   useAgentClientTool("setLocation", (fn) => {
 *     const params = JSON.parse(fn.arguments);
 *     setLocation(params);
 *     return JSON.stringify({ ok: true });
 *   });
 *
 *   return <Map center={location} />;
 * }
 * ```
 */
export function useAgentClientTool(
  name: string,
  handler: (fn: FunctionCallItem) => Promise<string> | string,
): void {
  const { registerClientTool } = useAgentContext();

  useEffect(() => {
    return registerClientTool(name, handler);
    // Re-register when handler changes to pick up latest closure
  }, [name, handler, registerClientTool]);
}
