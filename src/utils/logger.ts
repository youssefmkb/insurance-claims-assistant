export type LogLevel = "info" | "warn" | "error" | "debug";

export function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;

  if (data) {
    console.error(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.error(`${prefix} ${message}`);
  }
}