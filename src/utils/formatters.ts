/**
 * Sanket Utility and Formatting Helpers
 */

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatScore(score: number): string {
  return Math.min(100, Math.max(0, Math.round(score))).toString();
}
