import { createFileRoute } from "@tanstack/react-router";
import { fetchUserProgressFromFirestore } from "@/lib/reminder-stats.server";
import { sendStudyReminderEmail } from "@/lib/email-dispatcher.server";

export const Route = createFileRoute("/api/public/daily-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const ownToken = process.env["REMINDER_CRON_TOKEN"];
        if (ownToken && token !== ownToken) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let body: { to?: string; userId?: string } = {};
        try {
          body = await request.json();
        } catch {
          // Empty or non-JSON body is OK
        }

        const recipientEmail = body.to || "mmhb112010@gmail.com";
        const progressData = await fetchUserProgressFromFirestore(body.userId);

        const dispatchResult = await sendStudyReminderEmail({
          to: recipientEmail,
          summary: progressData,
        });

        if (!dispatchResult.success) {
          return new Response(
            JSON.stringify({
              status: "email_not_sent",
              message: dispatchResult.error || "Email provider is not ready.",
              timestamp: new Date().toISOString(),
              provider: dispatchResult.provider,
              recipient: dispatchResult.recipient,
              messageId: dispatchResult.messageId,
              summary: progressData,
            }),
            {
              status: dispatchResult.provider === "not_configured" ? 503 : 502,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            status: "ok",
            message: "Daily study digest generated and dispatched",
            timestamp: new Date().toISOString(),
            provider: dispatchResult.provider,
            recipient: dispatchResult.recipient,
            messageId: dispatchResult.messageId,
            summary: progressData,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  },
});
