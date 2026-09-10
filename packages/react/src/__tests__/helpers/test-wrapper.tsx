import React from "react";
import type { AgentProviderProps } from "../../provider.js";

// Import mock-sdk first to install mocks before provider loads
import "./mock-sdk.js";

// Import provider AFTER mocks are installed
const { AgentProvider } = await import("../../provider.js");

const DEFAULT_CONFIG = {
  auth: { apiKey: "test-key" },
  agent: { think: { provider: { type: "open_ai" as const, model: "gpt-4o-mini" } } },
};

/**
 * Wrapper component for testing hooks and components inside AgentProvider.
 */
export function TestProvider({
  children,
  config = DEFAULT_CONFIG,
  ...props
}: Partial<AgentProviderProps> & { children: React.ReactNode }) {
  return (
    <AgentProvider config={config as AgentProviderProps["config"]} {...props}>
      {children}
    </AgentProvider>
  );
}

export function createWrapper(props?: Partial<AgentProviderProps>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TestProvider {...props}>{children}</TestProvider>;
  };
}

export { DEFAULT_CONFIG };
