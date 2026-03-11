export interface OdinAction {
  id: string;
  label: string;
  type: "approve" | "reject" | "custom";
  payload?: Record<string, unknown>;
}

export interface OdinMessage {
  id: string;
  timestamp: number;
  role: "user" | "odin";
  type: "command" | "response" | "approval_request" | "notification" | "progress";
  content: string;
  actions?: OdinAction[];
  metadata?: {
    tp?: string;
    agent?: string;
    skill?: string;
    severity?: "info" | "warning" | "critical";
  };
}

export interface CommandResult {
  messages: OdinMessage[];
}
