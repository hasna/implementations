export function sanitizeTerminal(value: string): string {
  // Strip control characters that can be used for terminal escape injection.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

export function safeText(value: unknown): string {
  return sanitizeTerminal(String(value ?? ""));
}
