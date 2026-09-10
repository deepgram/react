import { jest, mock } from "bun:test";
import EventEmitter from "eventemitter3";

/**
 * Mock AgentSession that uses a real EventEmitter so on/emit work
 * naturally in tests. All send/lifecycle methods are jest.fn() spies.
 */
export class MockAgentSession extends EventEmitter {
  state = "idle" as string;
  conversationHistory: Array<{ type: string; role: string; content: string }> = [];

  connect = jest.fn(async () => {
    this.state = "connected";
    this.emit("connecting");
    this.emit("connected");
  });

  disconnect = jest.fn(() => {
    this.state = "disconnected";
    this.emit("disconnected", "user requested disconnect");
  });

  sendAudio = jest.fn();
  sendFunctionCallResponse = jest.fn();
  injectUserMessage = jest.fn();
  injectAgentMessage = jest.fn();
  updateListen = jest.fn();
  updateSpeak = jest.fn();
  updateThink = jest.fn();
  updatePrompt = jest.fn();
  clearConversationHistory = jest.fn(() => {
    this.conversationHistory.length = 0;
  });
}

let nextMicrophoneStartError: Error | null = null;
let nextMicrophoneStartDeferred: Promise<void> | null = null;

export class MockAgentMicrophone {
  muted = false;
  start = jest.fn(async () => {
    if (nextMicrophoneStartDeferred) {
      const deferred = nextMicrophoneStartDeferred;
      nextMicrophoneStartDeferred = null;
      await deferred;
    }
    if (nextMicrophoneStartError) {
      const error = nextMicrophoneStartError;
      nextMicrophoneStartError = null;
      throw error;
    }
  });
  stop = jest.fn();
  mute = jest.fn(() => { this.muted = true; });
  unmute = jest.fn(() => { this.muted = false; });
  getInputVolume = jest.fn(() => 0);
  getInputByteFrequencyData = jest.fn(() => new Uint8Array(0));
  on = jest.fn();
  off = jest.fn();
}

export class MockAgentPlayer {
  muted = false;
  disposed = false;
  queue = jest.fn(() => {
    if (this.disposed) throw new Error("cannot queue on a disposed player");
  });
  interrupt = jest.fn();
  mute = jest.fn(() => { this.muted = true; });
  unmute = jest.fn(() => { this.muted = false; });
  setVolume = jest.fn();
  getOutputVolume = jest.fn(() => 0);
  getOutputByteFrequencyData = jest.fn(() => new Uint8Array(0));
  getRemainingPlaybackTime = jest.fn(() => 0);
  dispose = jest.fn(() => { this.disposed = true; });
}

// Track instances created so tests can access them
export let lastSession: MockAgentSession;
export let lastMicrophone: MockAgentMicrophone;
export let lastPlayer: MockAgentPlayer;
export const sessions: MockAgentSession[] = [];
export const microphones: MockAgentMicrophone[] = [];
export const players: MockAgentPlayer[] = [];

export function failNextMicrophoneStart(error: Error) {
  nextMicrophoneStartError = error;
}

export function deferNextMicrophoneStart() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  nextMicrophoneStartDeferred = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject };
}

export function resetMocks() {
  lastSession = undefined!;
  lastMicrophone = undefined!;
  lastPlayer = undefined!;
  sessions.length = 0;
  microphones.length = 0;
  players.length = 0;
  nextMicrophoneStartError = null;
  nextMicrophoneStartDeferred = null;
}

// Install module-level mock
mock.module("@deepgram/agents", () => ({
  AgentSession: class extends MockAgentSession {
    constructor(...args: unknown[]) {
      super();
      lastSession = this as unknown as MockAgentSession;
      sessions.push(lastSession);
    }
  },
  AgentMicrophone: class extends MockAgentMicrophone {
    constructor(...args: unknown[]) {
      super();
      lastMicrophone = this as unknown as MockAgentMicrophone;
      microphones.push(lastMicrophone);
    }
  },
  AgentPlayer: class extends MockAgentPlayer {
    constructor(...args: unknown[]) {
      super();
      lastPlayer = this as unknown as MockAgentPlayer;
      players.push(lastPlayer);
    }
  },
}));
