export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[Study Spark] Runtime error caught:", error, context);
}

// Backwards compatibility alias
export const reportLovableError = reportAppError;
