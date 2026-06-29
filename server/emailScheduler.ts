/**
 * emailScheduler.ts
 *
 * Three responsibilities:
 *   1. processEmailQueue()        — picks up pending/retry-eligible emails and sends via Mailgun
 *   2. scheduleReminderEmails()   — finds enrollments whose class starts in ~48 hours and queues
 *      a reminder email if one hasn't been sent yet
 *   3. scheduleRenewalReminders() — finds due CCW renewal reminders (18 months after check-in)
 *      and queues renewal reminder emails
 *
 * Called by server/_core/index.ts on a 15-minute interval.
 *
 * NOTE: Both functions use raw mysql2/promise connections to avoid the MySQL prepared-statement
 * LIMIT parameter issue that occurs with Drizzle ORM's parameterized queries.
 */

import mysql from "mysql2/promise";
import { getDb, getDueCcwRenewals, markCcwRenewalSent, queueEmail, getIntegrationSettings } from "./db";
import { sendEmailViaMailgun } from "./email";
import { emailQueue, classes } from "../drizzle/schema";
import { eq, and, lte, notInArray } from "drizzle-orm";

// Raw MySQL connection for queries that Drizzle can't run as prepared statements (e.g. parameterized LIMIT)
async function getRawConn() {
  return mysql.createConnection(process.env.DATABASE_URL!);
}

const MAX_ATTEMPTS = 5;

// ─── Process Email Queue ──────────────────────────────────────────────────────

export async function processEmailQueue(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Pick up pending emails and failed emails that are due for retry
  // NOTE: Use raw mysql2 connection to avoid MySQL prepared-statement LIMIT parameter issue
  const rawConn = await getRawConn();
  const [pendingRaw] = await rawConn.query(
    `SELECT * FROM emailQueue WHERE status IN ('pending', 'failed') AND retryCount < ${MAX_ATTEMPTS} AND (scheduledFor IS NULL OR scheduledFor <= NOW()) LIMIT 50`
  );
  await rawConn.end();
  const pending = pendingRaw as typeof emailQueue.$inferSelect[];

  for (const item of pending) {
    try {
      // Mark as processing to prevent double-send in concurrent runs
      await db
        .update(emailQueue)
        .set({ status: "failed" }) // temporarily mark; will set to sent on success
        .where(eq(emailQueue.id, item.id));

      await sendEmailViaMailgun({
        to: item.toEmail,
        toName: item.toName ?? undefined,
        subject: item.subject ?? "(no subject)",
        html: item.bodyHtml ?? "",
      });

      // Mark as sent
      await db
        .update(emailQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailQueue.id, item.id));

      console.log(`[EmailScheduler] Sent email ${item.id} to ${item.toEmail}`);
    } catch (err: any) {
      const newRetryCount = (item.retryCount ?? 0) + 1;
      const isPermanentlyFailed = newRetryCount >= MAX_ATTEMPTS;

      await db
        .update(emailQueue)
        .set({
          status: isPermanentlyFailed ? "failed" : "pending",
          retryCount: newRetryCount,
          errorMessage: (err.message ?? "Unknown error").substring(0, 1000),
        })
        .where(eq(emailQueue.id, item.id));

      console.error(`[EmailScheduler] Failed to send email ${item.id} (attempt ${newRetryCount}):`, err.message);
    }
  }
}

// ─── Schedule 2-Day Reminder Emails ──────────────────────────────────────────

export async function scheduleReminderEmails(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Find classes starting between 47 and 49 hours from now (the 2-day window)
  const now = new Date();
  const windowStart = new Date(now.getTime() + 47 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000);

  // Use raw mysql2 to avoid Drizzle prepared-statement LIMIT issue
  const rawConn = await getRawConn();

  let dueEnrollments: any[] = [];
  try {
    const [rows] = await rawConn.query(
      `SELECT
        e.id AS enrollmentId,
        e.studentId,
        e.classId,
        s.firstName AS studentFirstName,
        s.lastName AS studentLastName,
        s.email AS studentEmail,
        c.title AS classTitle,
        c.startDatetime AS classStartDatetime,
        l.name AS locationName,
        l.address1 AS locationAddress1,
        l.city AS locationCity,
        l.state AS locationState
      FROM enrollments e
      INNER JOIN students s ON e.studentId = s.id
      INNER JOIN classes c ON e.classId = c.id
      INNER JOIN locations l ON c.locationId = l.id
      WHERE e.status = 'enrolled'
        AND c.startDatetime >= ?
        AND c.startDatetime <= ?`,
      [windowStart, windowEnd]
    );
    dueEnrollments = rows as any[];
  } catch (err: any) {
    console.error("[EmailScheduler] Error fetching due enrollments:", err.message);
    await rawConn.end();
    return;
  }

  for (const row of dueEnrollments) {
    // Check if a reminder has already been queued for this enrollment (raw query to avoid LIMIT issue)
    const [existingRows] = await rawConn.query(
      `SELECT id FROM emailQueue WHERE enrollmentId = ? AND templateKey = 'reminder' LIMIT 1`,
      [row.enrollmentId]
    );
    const existing = existingRows as any[];
    if (existing.length > 0) continue; // Already queued

    const classDate = new Date(row.classStartDatetime).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });
    const classTime = new Date(row.classStartDatetime).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });

    const locationLine = [row.locationAddress1, row.locationCity, row.locationState]
      .filter(Boolean)
      .join(", ");

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1a1a1a; padding: 24px; text-align: center;">
    <h1 style="color: #c0392b; margin: 0;">Right 2 Bear</h1>
    <p style="color: #ffffff; margin: 4px 0 0;">Class Reminder</p>
  </div>
  <div style="padding: 24px; background: #ffffff;">
    <p>Hi ${row.studentFirstName},</p>
    <p>This is a friendly reminder that your class is coming up in <strong>2 days</strong>!</p>
    <div style="background: #f5f5f5; border-left: 4px solid #c0392b; padding: 16px; margin: 16px 0;">
      <h2 style="margin: 0 0 8px; color: #1a1a1a;">${row.classTitle}</h2>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${classDate}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${classTime}</p>
      <p style="margin: 4px 0;"><strong>Location:</strong> ${row.locationName}</p>
      ${locationLine ? `<p style="margin: 4px 0;">${locationLine}</p>` : ""}
    </div>
    <p>Please arrive 10–15 minutes early. Bring a valid government-issued photo ID.</p>
    <p>Questions? Email us at <a href="mailto:info@r2bear.com">info@r2bear.com</a>.</p>
    <p>See you soon!</p>
    <p>— The Right 2 Bear Team</p>
  </div>
</div>`;

    await db.insert(emailQueue).values({
      enrollmentId: row.enrollmentId,
      classId: row.classId,
      studentId: row.studentId,
      toEmail: row.studentEmail,
      toName: `${row.studentFirstName} ${row.studentLastName}`,
      templateKey: "reminder",
      subject: `Reminder: ${row.classTitle} is in 2 days`,
      bodyHtml,
      scheduledFor: new Date(), // send immediately when picked up
      status: "pending",
      retryCount: 0,
    });

    console.log(`[EmailScheduler] Queued reminder for enrollment ${row.enrollmentId} (${row.studentEmail})`);
  }

  await rawConn.end();
}

// ─── Schedule CCW Renewal Reminder Emails ────────────────────────────────────
// Finds ccwRenewalReminders rows that are due (scheduledFor <= now, status=pending)
// and queues a renewal reminder email for each one.

export async function scheduleRenewalReminders(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const due = await getDueCcwRenewals();
  if (due.length === 0) return;

  const settings = await getIntegrationSettings();
  const renewalUrl = settings?.ccwRenewalProductUrl ?? "https://r2bear.com";

  for (const item of due) {
    try {
      const classDate = new Date(item.class.startDatetime).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });

      const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1a1a1a; padding: 24px; text-align: center;">
    <h1 style="color: #c0392b; margin: 0;">Right 2 Bear</h1>
    <p style="color: #ffffff; margin: 4px 0 0;">CCW Renewal Reminder</p>
  </div>
  <div style="padding: 24px; background: #ffffff;">
    <p>Hi ${item.student.firstName},</p>
    <p>It's been <strong>18 months</strong> since you completed your CCW class on <strong>${classDate}</strong>.</p>
    <p>Your California CCW permit requires renewal — don't let it lapse! We'd love to see you back at Right 2 Bear for your Re-Certification class.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${renewalUrl}" style="background: #c0392b; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Book Your Renewal Class</a>
    </div>
    <p>Questions? Email us at <a href="mailto:info@r2bear.com">info@r2bear.com</a> or call us anytime.</p>
    <p>See you soon!</p>
    <p>— The Right 2 Bear Team</p>
  </div>
  <div style="background: #f5f5f5; padding: 12px 24px; text-align: center; font-size: 12px; color: #666;">
    <p style="margin: 0;">You are receiving this because you attended a CCW class with Right 2 Bear.</p>
  </div>
</div>`;

      const emailQueueId = await queueEmail({
        enrollmentId: item.enrollmentId,
        classId: item.classId,
        studentId: item.studentId,
        toEmail: item.student.email,
        toName: `${item.student.firstName} ${item.student.lastName}`,
        templateKey: "ccw_renewal",
        subject: "Time to Renew Your CCW — Right 2 Bear",
        bodyHtml,
        scheduledFor: new Date(),
      });

      await markCcwRenewalSent(item.id, emailQueueId);
      console.log(`[RenewalReminder] Queued renewal email for student ${item.studentId} (${item.student.email})`);
    } catch (err: any) {
      console.error(`[RenewalReminder] Failed to queue renewal for reminder ${item.id}:`, err.message);
    }
  }
}

// ─── Auto-Archive Past Classes ────────────────────────────────────────────────
// Marks classes as 'archived' once their end time + 8-hour buffer has passed.
// Only affects classes with status 'upcoming', 'in_progress', or 'completed'.

export async function autoArchiveClasses(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Archive threshold: now minus 8 hours (classes whose end time was 8+ hours ago)
  const archiveThreshold = new Date(Date.now() - 8 * 60 * 60 * 1000);

  try {
    const result = await db
      .update(classes)
      .set({ status: "archived" })
      .where(
        and(
          lte(classes.endDatetime, archiveThreshold),
          eq(classes.isActive, true),
          notInArray(classes.status, ["archived", "cancelled"])
        )
      );
    const affected = (result as any)[0]?.affectedRows ?? 0;
    if (affected > 0) {
      console.log(`[AutoArchive] Archived ${affected} class(es) past the 8-hour buffer`);
    }
  } catch (err: any) {
    console.error("[AutoArchive] Error archiving classes:", err.message);
  }
}
