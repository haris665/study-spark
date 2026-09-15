import { createServerFn } from "@tanstack/react-start";
import { localStore } from "./local-store";

/** Sends a test or scheduled daily study reminder with live progress stats and missed targets */
export const sendReminderNow = createServerFn({ method: "POST" })
  .inputValidator(
    (input: unknown) =>
      (input ?? {}) as {
        to?: string;
        name?: string;
        examName?: string;
        streak?: number;
        accuracy?: number;
        bank?: number;
        remaining?: number;
        missedTargets?: string[];
      },
  )
  .handler(async ({ data }) => {
    const profile = localStore.getProfile();
    const to = data?.to || profile.reminder_email || profile.email || "mmhb112010@gmail.com";

    const { sendStudyReminderEmail } = await import("./email-dispatcher.server");

    const summary = {
      name: data?.name ?? profile.display_name ?? "Student",
      examName: data?.examName ?? profile.exam_name ?? "MDCAT 2026",
      streak: data?.streak ?? 7,
      accuracy: data?.accuracy ?? 82,
      bank: data?.bank ?? 240,
      remaining: data?.remaining ?? 68,
      missedTargets: data?.missedTargets ?? [
        "Daily Practice Target: 14/25 MCQs completed today (11 remaining)",
        "Spaced Repetition: 8 review flashcards due in your queue",
      ],
    };

    const result = await sendStudyReminderEmail({
      to,
      summary,
    });

    return {
      sent: result.success,
      to: result.recipient,
      provider: result.provider,
      messageId: result.messageId,
      error: result.error,
      summary,
    };
  });
