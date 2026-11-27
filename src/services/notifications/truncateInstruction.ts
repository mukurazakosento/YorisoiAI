/** Instruction notify title/body must stay ≤17 Japanese characters. Mirrors AssistNotifier. */
export const MAX_INSTRUCTION_NOTIFY_CHARS = 17;

/** Truncate notify title/body to [MAX_INSTRUCTION_NOTIFY_CHARS] (ellipsis when cut). */
export function truncateInstructionNotifyText(
  text: string,
  maxChars: number = MAX_INSTRUCTION_NOTIFY_CHARS,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars <= 1) {
    return trimmed.slice(0, maxChars);
  }
  return `${trimmed.slice(0, maxChars - 1)}…`;
}
