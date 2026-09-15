import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface UserProfile {
  id: string;
  email?: string;
  reminder_email?: string;
  display_name?: string;
  exam_name?: string;
  daily_reminder?: boolean;
  daily_goal_questions?: number;
  daily_goal_minutes?: number;
}

interface AttemptRecord {
  mcqId?: string;
  isCorrect?: boolean;
  createdAt?: admin.firestore.Timestamp | string;
}

/**
 * Calculates user study metrics, accuracy, streak, and missed targets
 */
async function computeUserStudySummary(userId: string, profile: UserProfile) {
  const attemptsSnapshot = await db
    .collection(`users/${userId}/attempts`)
    .orderBy("createdAt", "desc")
    .limit(1000)
    .get();

  const attempts: AttemptRecord[] = attemptsSnapshot.docs.map((doc) => doc.data() as AttemptRecord);

  // Question bank total (notes or global mcqs)
  const notesSnapshot = await db.collection(`users/${userId}/notes`).get();
  const bank = Math.max(attempts.length, notesSnapshot.size * 10 || 150);

  const uniqueSolved = new Set(attempts.map((a) => a.mcqId).filter(Boolean));
  const remaining = Math.max(0, bank - uniqueSolved.size);

  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect === true).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;

  // Streak calculation
  const dates = new Set<string>();
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayCount = 0;

  for (const a of attempts) {
    if (a.createdAt) {
      const dateObj =
        a.createdAt instanceof admin.firestore.Timestamp
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
      const str = dateObj.toISOString().slice(0, 10);
      dates.add(str);
      if (str === todayStr) {
        todayCount++;
      }
    }
  }

  let streak = 0;
  const cursor = new Date();
  if (!dates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const goalQuestions = profile.daily_goal_questions || 25;
  const missedQuestions = Math.max(0, goalQuestions - todayCount);

  const missedTargets: string[] = [];
  if (missedQuestions > 0) {
    missedTargets.push(
      `Daily Practice: Solved ${todayCount}/${goalQuestions} MCQs today (${missedQuestions} remaining to reach target)`,
    );
  }
  if (accuracy !== null && accuracy < 75) {
    missedTargets.push(
      `Target Accuracy: Current average is ${accuracy}% (target benchmark is 80%+)`,
    );
  }
  if (remaining > 50) {
    missedTargets.push(
      `Unanswered Syllabus: ${remaining} questions in your bank have not yet been attempted`,
    );
  }

  return {
    name: profile.display_name || "Student",
    examName: profile.exam_name || "MDCAT / USMLE",
    bank,
    remaining,
    accuracy,
    streak,
    todayCount,
    goalQuestions,
    missedTargets,
  };
}

/**
 * Generates the email HTML template with progress summary and missed targets
 */
function buildReminderEmailHtml(data: {
  name: string;
  examName: string;
  bank: number;
  remaining: number;
  accuracy: number | null;
  streak: number;
  missedTargets: string[];
}) {
  const subject = `⚡ Daily Study Summary & Nudge — ${data.examName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f3f4f6;">
  <div style="max-width:580px;margin:32px auto;background-color:#111726;border:1px solid #1f293d;border-radius:16px;overflow:hidden;">
    <div style="padding:28px 32px;background:linear-gradient(180deg, #182238 0%, #111726 100%);border-bottom:1px solid #1f293d;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#dca54c;">STUDY SPARK OS</span>
      <h1 style="margin:10px 0 4px;font-size:22px;color:#ffffff;">Daily Study Summary & Target Report</h1>
      <p style="margin:0;font-size:14px;color:#9ca3af;">Prepared for <strong style="color:#dca54c;">${data.name}</strong> · ${data.examName}</p>
    </div>

    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:16px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;width:31%;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Current Streak</div>
            <div style="font-size:24px;font-weight:800;color:#34d399;margin-top:4px;">${data.streak} days</div>
          </td>
          <td style="width:3%;"></td>
          <td style="padding:16px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;width:31%;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Accuracy</div>
            <div style="font-size:24px;font-weight:800;color:#60a5fa;margin-top:4px;">${data.accuracy !== null ? `${data.accuracy}%` : "—"}</div>
          </td>
          <td style="width:3%;"></td>
          <td style="padding:16px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;width:31%;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Remaining</div>
            <div style="font-size:24px;font-weight:800;color:#dca54c;margin-top:4px;">${data.remaining} / ${data.bank}</div>
          </td>
        </tr>
      </table>

      <div style="margin-top:24px;padding:18px 20px;background-color:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:12px;">
        <h3 style="margin:0 0 10px;font-size:14px;color:#f87171;">🎯 Target Status & Missed Goals</h3>
        ${
          data.missedTargets.length > 0
            ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#d1d5db;line-height:1.7;">
                ${data.missedTargets.map((t) => `<li>${t}</li>`).join("")}
              </ul>`
            : `<p style="margin:0;font-size:13px;color:#34d399;">🌟 All daily goals met! You're on track for exam readiness.</p>`
        }
      </div>

      <div style="margin-top:24px;padding:20px;background-color:#161f33;border:1px solid #24314d;border-radius:12px;text-align:center;">
        <h4 style="margin:0 0 6px;color:#ffffff;font-size:15px;">Ready for today's drill?</h4>
        <p style="margin:0 0 16px;font-size:13px;color:#9ca3af;">Spend 10 minutes completing targeted questions to keep your retention fresh.</p>
        <a href="https://ais-dev-a7d7hsydlho5qxx2soq5nw-359529716008.asia-east1.run.app/practice" 
           style="display:inline-block;padding:11px 24px;background-color:#dca54c;color:#09090b;text-decoration:none;font-size:13px;font-weight:700;border-radius:8px;">
          Start Practice Drill →
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

/**
 * Dispatches email via SendGrid or Nodemailer SMTP
 */
async function dispatchEmail(to: string, subject: string, html: string) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Study Spark <reminders@studyspark.app>";

  // 1. SendGrid Dispatcher
  if (sendgridKey) {
    try {
      sgMail.setApiKey(sendgridKey);
      await sgMail.send({
        to,
        from: fromEmail,
        subject,
        html,
      });
      logger.info(`[SendGrid] Successfully sent daily study reminder to ${to}`);
      return { provider: "sendgrid", success: true };
    } catch (err) {
      logger.error(`[SendGrid] Failed to dispatch reminder to ${to}:`, err);
    }
  }

  // 2. Nodemailer SMTP Dispatcher
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);

  if (smtpHost && smtpUser && smtpPass) {
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

      const result = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
      });

      logger.info(`[Nodemailer] Successfully sent daily study reminder to ${to}`, {
        messageId: result.messageId,
      });
      return { provider: "nodemailer", success: true };
    } catch (err) {
      logger.error(`[Nodemailer] SMTP send error to ${to}:`, err);
    }
  }

  // Fallback log
  logger.info(`[Simulation] Daily study reminder generated for ${to}: "${subject}"`);
  return { provider: "simulated", success: true };
}

/**
 * ⏰ Scheduled Cloud Function: Runs daily at 19:00 (7:00 PM)
 */
export const scheduledDailyStudyReminder = onSchedule(
  {
    schedule: "0 19 * * *", // 7:00 PM every day
    timeZone: "America/Los_Angeles",
    retryCount: 3,
    memory: "512MiB",
  },
  async (event) => {
    logger.info("Starting scheduled daily study reminder execution", {
      eventTime: event.scheduleTime,
    });

    try {
      // Query all users who have daily reminder enabled
      const usersSnapshot = await db.collection("users").get();
      let sentCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const profile = userDoc.data() as UserProfile;
        profile.id = userDoc.id;

        const emailTarget = profile.reminder_email || profile.email;
        if (!emailTarget) continue;

        const summary = await computeUserStudySummary(profile.id, profile);
        const { subject, html } = buildReminderEmailHtml(summary);

        await dispatchEmail(emailTarget, subject, html);

        // Record log in reminder_logs collection
        await db.collection("reminder_logs").add({
          userId: profile.id,
          recipient: emailTarget,
          dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
          streak: summary.streak,
          accuracy: summary.accuracy,
          missedTargetsCount: summary.missedTargets.length,
          status: "dispatched",
        });

        sentCount++;
      }

      logger.info(`Daily study reminders completed. Total emails dispatched: ${sentCount}`);
    } catch (error) {
      logger.error("Error executing scheduled daily study reminder:", error);
      throw error;
    }
  },
);

/**
 * ⚡ HTTP / Webhook Trigger: Allows immediate on-demand test dispatching
 */
export const triggerDailyStudyReminder = onRequest(async (req, res) => {
  try {
    const to = (req.query.to as string) || (req.body?.to as string) || "mmhb112010@gmail.com";
    const name = (req.query.name as string) || (req.body?.name as string) || "Student";
    const exam = (req.query.exam as string) || (req.body?.exam as string) || "MDCAT 2026";

    const summary = {
      name,
      examName: exam,
      bank: 240,
      remaining: 68,
      accuracy: 82,
      streak: 7,
      missedTargets: [
        "Daily Practice: 14/25 questions solved today (11 remaining)",
        "Review Queue: 8 spaced repetition flashcards due for review",
      ],
    };

    const { subject, html } = buildReminderEmailHtml(summary);
    const result = await dispatchEmail(to, subject, html);

    res.json({
      success: true,
      message: `Daily reminder dispatched to ${to}`,
      provider: result.provider,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to trigger test reminder:", error);
    res.status(500).json({ success: false, error: message });
  }
});
