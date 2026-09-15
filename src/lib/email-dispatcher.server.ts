/**
 * Server-side email dispatcher supporting SendGrid and Nodemailer (SMTP).
 * When no real provider is configured, the caller receives a clear setup result.
 */

import nodemailer from "nodemailer";

export interface ProgressSummaryData {
  name?: string | null;
  examName?: string | null;
  bank: number;
  remaining: number;
  accuracy: number | null;
  streak: number;
  dailyGoalQuestions?: number;
  completedTodayQuestions?: number;
  dailyGoalMinutes?: number;
  completedTodayMinutes?: number;
  missedTargets?: string[];
  weakSubjects?: string[];
  dueReviewsCount?: number;
}

export function buildProgressSummaryHtml(data: ProgressSummaryData): {
  subject: string;
  html: string;
  text: string;
} {
  const exam = data.examName?.trim() || "MDCAT 2026";
  const name = data.name?.trim() || "Student";
  const subject = `⚡ Daily Study Summary & Nudge — ${exam}`;

  const goalQ = data.dailyGoalQuestions ?? 25;
  const doneQ = data.completedTodayQuestions ?? 0;
  const missedQ = Math.max(0, goalQ - doneQ);

  const goalMin = data.dailyGoalMinutes ?? 45;
  const doneMin = data.completedTodayMinutes ?? 0;
  const missedMin = Math.max(0, goalMin - doneMin);

  const missedTargetsList =
    data.missedTargets && data.missedTargets.length > 0
      ? data.missedTargets
      : [
          ...(missedQ > 0
            ? [`Daily Question Target: ${doneQ}/${goalQ} solved (${missedQ} remaining)`]
            : []),
          ...(missedMin > 0
            ? [`Focus Time Target: ${doneMin}/${goalMin} minutes (${missedMin}m to goal)`]
            : []),
          ...(data.dueReviewsCount && data.dueReviewsCount > 0
            ? [`${data.dueReviewsCount} spaced repetition cards due for review`]
            : []),
        ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0b0f19;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;background-color:#111726;border:1px solid #1f293d;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #1f293d;background:linear-gradient(180deg, #182238 0%, #111726 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#dca54c;background-color:rgba(220,165,76,0.12);border:1px solid rgba(220,165,76,0.25);border-radius:6px;">
                      Study Spark OS
                    </span>
                    <h1 style="margin:12px 0 4px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                      Daily Study Summary & Target Report
                    </h1>
                    <p style="margin:0;font-size:14px;color:#9ca3af;">
                      Prepared for <strong style="color:#dca54c;">${name}</strong> · ${exam}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Metrics Grid -->
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="31%" style="padding:16px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px;">Current Streak</div>
                    <div style="font-size:24px;font-weight:800;color:#34d399;">${data.streak} <span style="font-size:14px;font-weight:500;color:#9ca3af;">days</span></div>
                  </td>
                  <td width="3.5%"></td>
                  <td width="31%" style="padding:16px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px;">Accuracy</div>
                    <div style="font-size:24px;font-weight:800;color:#60a5fa;">${data.accuracy === null ? "—" : `${data.accuracy}%`}</div>
                  </td>
                  <td width="3.5%"></td>
                  <td width="31%" style="padding:16px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px;">Remaining Bank</div>
                    <div style="font-size:24px;font-weight:800;color:#dca54c;">${data.remaining} <span style="font-size:12px;font-weight:400;color:#9ca3af;">/ ${data.bank}</span></div>
                  </td>
                </tr>
              </table>

              <!-- Missed Targets & Action Items -->
              <div style="margin-top:24px;padding:18px 20px;background-color:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;">
                <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#f87171;display:flex;align-items:center;">
                  🎯 Target Status & Missed Goals
                </h3>
                ${
                  missedTargetsList.length > 0
                    ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#d1d5db;line-height:1.7;">
                        ${missedTargetsList.map((t) => `<li>${t}</li>`).join("")}
                      </ul>`
                    : `<p style="margin:0;font-size:13px;color:#34d399;">🌟 All daily practice targets are achieved! Great job keeping up the momentum.</p>`
                }
              </div>

              <!-- Recommendation / Call to action -->
              <div style="margin-top:24px;padding:20px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;">
                <h4 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#ffffff;">
                  Ready for today's drill session?
                </h4>
                <p style="margin:0 0 16px;font-size:13px;color:#9ca3af;line-height:1.5;">
                  Take 10 minutes to complete a targeted practice test and keep your retention high.
                </p>
                <a href="https://ais-dev-a7d7hsydlho5qxx2soq5nw-359529716008.asia-east1.run.app/practice" 
                   style="display:inline-block;padding:11px 24px;background-color:#dca54c;color:#09090b;text-decoration:none;font-size:13px;font-weight:700;border-radius:8px;box-shadow:0 2px 8px rgba(220,165,76,0.3);">
                  Start Practice Test →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #1f293d;background-color:#0d121f;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You received this email because daily study reminders are enabled on your Study Spark account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Study Spark Daily Study Summary
Prepared for: ${name} (${exam})

Key Metrics:
- Streak: ${data.streak} days
- Accuracy: ${data.accuracy !== null ? `${data.accuracy}%` : "No attempts yet"}
- Unanswered Bank: ${data.remaining} / ${data.bank}

Missed Targets & Action Items:
${missedTargetsList.map((t) => `* ${t}`).join("\n")}

Start practice: https://ais-dev-a7d7hsydlho5qxx2soq5nw-359529716008.asia-east1.run.app/practice
`;

  return { subject, html, text };
}

export async function sendStudyReminderEmail(params: {
  to: string;
  summary: ProgressSummaryData;
}): Promise<{
  success: boolean;
  provider: "sendgrid" | "nodemailer" | "not_configured" | "failed";
  messageId: string;
  recipient: string;
  error?: string;
}> {
  const { to, summary } = params;
  const { subject, html, text } = buildProgressSummaryHtml(summary);
  const fromAddress = process.env["EMAIL_FROM"] || "Study Spark <reminders@studyspark.app>";

  // 1. SendGrid API if SENDGRID_API_KEY is provided
  const sendgridKey = process.env["SENDGRID_API_KEY"];
  let attemptedProvider: "sendgrid" | "nodemailer" | null = null;
  let lastError = "";
  if (sendgridKey) {
    attemptedProvider = "sendgrid";
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: {
            email: fromAddress.replace(/^.*<([^>]+)>$/, "$1") || "reminders@studyspark.app",
            name: "Study Spark",
          },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
        }),
      });

      if (res.ok || res.status === 202) {
        return {
          success: true,
          provider: "sendgrid",
          messageId: `sendgrid-${Date.now()}`,
          recipient: to,
        };
      }
      const errText = await res.text();
      lastError = `SendGrid returned ${res.status}: ${errText}`;
      console.warn(`[SendGrid] Error [${res.status}]: ${errText}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn("[SendGrid] Request failed:", err);
    }
  }

  // 2. Nodemailer (SMTP) if SMTP credentials exist
  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpPort = parseInt(process.env["SMTP_PORT"] || "587", 10);

  if (smtpHost && smtpUser && smtpPass) {
    attemptedProvider = "nodemailer";
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
      });

      return {
        success: true,
        provider: "nodemailer",
        messageId: info.messageId || `smtp-${Date.now()}`,
        recipient: to,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn("[Nodemailer] SMTP transport failed:", err);
    }
  }

  if (attemptedProvider) {
    const message = `${attemptedProvider} was configured but the email could not be sent. ${lastError}`.trim();
    return {
      success: false,
      provider: "failed",
      messageId: `email-failed-${Date.now()}`,
      recipient: to,
      error: message,
    };
  }

  const message =
    "No real email provider is configured. Add SENDGRID_API_KEY or SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM.";
  console.warn(`[Email Dispatcher] ${message}`);
  return {
    success: false,
    provider: "not_configured",
    messageId: `email-not-sent-${Date.now()}`,
    recipient: to,
    error: message,
  };
}
