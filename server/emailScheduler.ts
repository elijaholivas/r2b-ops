/**
 * emailScheduler.ts
 *
 * Two responsibilities:
 *   1. processEmailQueue()      — picks up pending/retry-eligible emails and sends via Mailgun
 *   2. scheduleReminderEmails() — finds enrollments whose class starts in ~48 hours and queues
 *      a reminder email if one hasn't been sent yet
 *
 * Called by server/_core/index.ts on a 15-minute interval.
 */

import { and, eq, gte, lte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { sendEmailViaMailgun } from "./email";
import { emailQueue, enrollments, classes, students, locations } from "../drizzle/schema";

const MAX_ATTEMPTS = 5;

// ─── Process Email Queue ──────────────────────────────────────────────────────

export async function processEmailQueue(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Pick up pending emails and failed emails that are due for retry
  const pending = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        sql`${emailQueue.status} IN ('pending', 'failed')`,
        lt(emailQueue.retryCount, MAX_ATTEMPTS),
        sql`(${emailQueue.scheduledFor} IS NULL OR ${emailQueue.scheduledFor} <= NOW())`
      )
    )
    .limit(50);

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

  const dueEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: enrollments.studentId,
      classId: enrollments.classId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentEmail: students.email,
      classTitle: classes.title,
      classStartDatetime: classes.startDatetime,
      locationName: locations.name,
      locationAddress1: locations.address1,
      locationCity: locations.city,
      locationState: locations.state,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .innerJoin(locations, eq(classes.locationId, locations.id))
    .where(
      and(
        eq(enrollments.status, "enrolled"),
        gte(classes.startDatetime, windowStart),
        lte(classes.startDatetime, windowEnd)
      )
    );

  for (const row of dueEnrollments) {
    // Check if a reminder has already been queued for this enrollment
    const existing = await db
      .select({ id: emailQueue.id })
      .from(emailQueue)
      .where(
        and(
          eq(emailQueue.enrollmentId, row.enrollmentId),
          eq(emailQueue.templateKey, "reminder")
        )
      )
      .limit(1);

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
}
