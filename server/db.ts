import { and, desc, eq, gte, ilike, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  ActivityLog,
  AdminAlert,
  Class,
  EmailQueueItem,
  Enrollment,
  InsertUser,
  Location,
  Student,
  User,
  activityLog,
  adminAlerts,
  classStaff,
  classes,
  emailQueue,
  emailTemplates,
  enrollments,
  integrationSettings,
  locations,
  students,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "super_admin";
    updateSet.role = "super_admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createUser(data: InsertUser): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(users).values(data);
  return (result[0] as any).insertId;
}

export async function listUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: User["role"]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function listLocations(): Promise<Location[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.isActive, true)).orderBy(locations.name);
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export async function listClasses(filter?: {
  status?: string;
  locationId?: number;
  upcoming?: boolean;
}): Promise<(Class & { location: Location | null; enrolledCount: number })[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(classes)
    .where(eq(classes.isActive, true))
    .orderBy(classes.startDatetime);

  const locationRows = await db.select().from(locations);
  const locationMap = new Map(locationRows.map((l) => [l.id, l]));

  const enrollmentCounts = await db
    .select({ classId: enrollments.classId, count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.status, "enrolled"))
    .groupBy(enrollments.classId);
  const countMap = new Map(enrollmentCounts.map((e) => [e.classId, Number(e.count)]));

  return rows
    .filter((c) => {
      if (filter?.status && c.status !== filter.status) return false;
      if (filter?.locationId && c.locationId !== filter.locationId) return false;
      if (filter?.upcoming && new Date(c.startDatetime) < new Date()) return false;
      return true;
    })
    .map((c) => ({
      ...c,
      location: locationMap.get(c.locationId ?? 0) ?? null,
      enrolledCount: countMap.get(c.id) ?? 0,
    }));
}

export async function getClassById(id: number): Promise<(Class & { location: Location | null; enrolledCount: number }) | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  if (!result[0]) return undefined;

  const cls = result[0];
  let location: Location | null = null;
  if (cls.locationId) {
    const locResult = await db.select().from(locations).where(eq(locations.id, cls.locationId)).limit(1);
    location = locResult[0] ?? null;
  }

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(and(eq(enrollments.classId, id), eq(enrollments.status, "enrolled")));

  return { ...cls, location, enrolledCount: Number(countResult[0]?.count ?? 0) };
}

export async function createClass(data: Omit<Class, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(classes).values(data as any);
  return (result[0] as any).insertId;
}

export async function updateClass(id: number, data: Partial<Class>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(classes).set(data as any).where(eq(classes.id, id));
}

// ─── Students ─────────────────────────────────────────────────────────────────

export async function findStudentByEmail(email: string): Promise<Student | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(students).where(eq(students.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getStudentById(id: number): Promise<Student | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return result[0];
}

export async function createStudent(data: Omit<Student, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(students).values({ ...data, email: data.email.toLowerCase() } as any);
  return (result[0] as any).insertId;
}

export async function searchStudents(query: string): Promise<(Student & { enrollments: (Enrollment & { class: Class | null })[] })[]> {
  const db = await getDb();
  if (!db) return [];

  const q = `%${query}%`;
  const studentRows = await db.select().from(students).where(
    or(
      like(students.firstName, q),
      like(students.lastName, q),
      like(students.email, q),
      like(students.phone, q)
    )
  ).limit(50);

  const results = [];
  for (const student of studentRows) {
    const enrollmentRows = await db.select().from(enrollments)
      .where(eq(enrollments.studentId, student.id))
      .orderBy(desc(enrollments.createdAt));

    const enriched = [];
    for (const enr of enrollmentRows) {
      const classResult = await db.select().from(classes).where(eq(classes.id, enr.classId)).limit(1);
      enriched.push({ ...enr, class: classResult[0] ?? null });
    }
    results.push({ ...student, enrollments: enriched });
  }
  return results;
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export async function getEnrollmentsForClass(classId: number): Promise<(Enrollment & { student: Student })[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.status, "enrolled")))
    .orderBy(enrollments.createdAt);

  const results = [];
  for (const enr of rows) {
    const studentResult = await db.select().from(students).where(eq(students.id, enr.studentId)).limit(1);
    if (studentResult[0]) results.push({ ...enr, student: studentResult[0] });
  }
  return results;
}

export async function findActiveEnrollment(classId: number, studentId: number): Promise<Enrollment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, studentId), eq(enrollments.status, "enrolled")))
    .limit(1);
  return result[0];
}

export async function createEnrollment(data: Omit<Enrollment, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(enrollments).values(data as any);
  return (result[0] as any).insertId;
}

export async function updateEnrollment(id: number, data: Partial<Enrollment>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(enrollments).set(data as any).where(eq(enrollments.id, id));
}

export async function getEnrollmentById(id: number): Promise<Enrollment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(enrollments).where(eq(enrollments.id, id)).limit(1);
  return result[0];
}

// ─── Atomic Move ──────────────────────────────────────────────────────────────

export async function moveStudentAtomic(params: {
  enrollmentId: number;
  fromClassId: number;
  toClassId: number;
  actorUserId: number;
  notifyStudent?: boolean;
}): Promise<{ success: boolean; newEnrollmentId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Verify source enrollment
  const sourceEnrollment = await getEnrollmentById(params.enrollmentId);
  if (!sourceEnrollment || sourceEnrollment.status !== "enrolled") {
    throw new Error("Source enrollment not found or not active");
  }

  // Verify destination class has capacity
  const destClass = await getClassById(params.toClassId);
  if (!destClass) throw new Error("Destination class not found");
  if (destClass.enrolledCount >= destClass.capacity) {
    throw new Error("Destination class is full");
  }

  // Fully atomic move — if any step fails the entire transaction rolls back
  let newEnrollmentId: number = 0;
  await db.transaction(async (tx) => {
    // 1. Mark old enrollment as moved
    await tx.update(enrollments).set({
      status: "moved",
      movedToClassId: params.toClassId,
      removedAt: new Date(),
    }).where(eq(enrollments.id, params.enrollmentId));

    // 2. Create new enrollment in destination class
    const newEnrollmentResult = await tx.insert(enrollments).values({
      classId: params.toClassId,
      studentId: sourceEnrollment.studentId,
      status: "enrolled",
      paymentStatus: sourceEnrollment.paymentStatus,
      source: sourceEnrollment.source,
      movedFromClassId: params.fromClassId,
      wooOrderId: sourceEnrollment.wooOrderId,
    } as any);
    newEnrollmentId = (newEnrollmentResult[0] as any).insertId;

    // 3. Log activity inside the same transaction
    await tx.insert(activityLog).values({
      actorUserId: params.actorUserId,
      actionType: "student_moved",
      entityType: "enrollment",
      entityId: params.enrollmentId,
      oldValues: JSON.stringify({ classId: params.fromClassId }),
      newValues: JSON.stringify({ classId: params.toClassId, newEnrollmentId }),
      notes: `Student moved from class ${params.fromClassId} to class ${params.toClassId}`,
    } as any);
  });

  return { success: true, newEnrollmentId };
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(data: {
  actorUserId?: number;
  actionType: string;
  entityType: string;
  entityId?: number;
  oldValues?: unknown;
  newValues?: unknown;
  notes?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(data as any);
}

export async function getRecentActivity(limit = 20): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

// ─── Email Queue ──────────────────────────────────────────────────────────────

export async function queueEmail(data: {
  enrollmentId?: number;
  classId?: number;
  studentId?: number;
  toEmail: string;
  toName?: string;
  templateKey: string;
  subject: string;
  bodyHtml: string;
  scheduledFor: Date;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(emailQueue).values({ ...data, status: "pending" } as any);
  return (result[0] as any).insertId;
}

export async function getPendingEmails(limit = 50): Promise<EmailQueueItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailQueue)
    .where(and(eq(emailQueue.status, "pending"), lte(emailQueue.scheduledFor, new Date())))
    .orderBy(emailQueue.scheduledFor)
    .limit(limit);
}

export async function getEmailQueueForAdmin(limit = 100): Promise<EmailQueueItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailQueue)
    .orderBy(desc(emailQueue.createdAt))
    .limit(limit);
}

export async function updateEmailStatus(id: number, status: "sent" | "failed" | "cancelled", errorMessage?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailQueue).set({
    status,
    sentAt: status === "sent" ? new Date() : undefined,
    errorMessage: errorMessage ?? null,
    retryCount: sql`retryCount + 1`,
  } as any).where(eq(emailQueue.id, id));
}

export async function getEmailTemplate(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, key)).limit(1);
  return result[0];
}

// ─── Admin Alerts ─────────────────────────────────────────────────────────────

export async function createAdminAlert(data: {
  alertType: string;
  title: string;
  message: string;
  metadata?: unknown;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAlerts).values(data as any);
}

export async function getAdminAlerts(unreadOnly = false): Promise<AdminAlert[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(adminAlerts);
  if (unreadOnly) {
    return query.where(eq(adminAlerts.isRead, false)).orderBy(desc(adminAlerts.createdAt)).limit(50);
  }
  return query.orderBy(desc(adminAlerts.createdAt)).limit(50);
}

export async function markAlertRead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(adminAlerts).set({ isRead: true }).where(eq(adminAlerts.id, id));
}

// ─── Integration Settings ─────────────────────────────────────────────────────

export async function getIntegrationSettings() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(integrationSettings).limit(1);
  return result[0];
}

export async function updateIntegrationSettings(data: Partial<typeof integrationSettings.$inferInsert>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getIntegrationSettings();
  if (existing) {
    await db.update(integrationSettings).set(data as any).where(eq(integrationSettings.id, existing.id));
  } else {
    await db.insert(integrationSettings).values(data as any);
  }
}

// ─── Enrollments for 2-day reminder ──────────────────────────────────────────

export async function getEnrollmentsNeedingReminder(): Promise<(Enrollment & { student: Student; class: Class })[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const twoDaysPlusHour = new Date(twoDaysFromNow.getTime() + 60 * 60 * 1000);

  // Get classes starting in ~2 days
  const upcomingClasses = await db.select().from(classes)
    .where(and(gte(classes.startDatetime, twoDaysFromNow), lte(classes.startDatetime, twoDaysPlusHour)));

  const results = [];
  for (const cls of upcomingClasses) {
    const enrollmentRows = await db.select().from(enrollments)
      .where(and(
        eq(enrollments.classId, cls.id),
        eq(enrollments.status, "enrolled"),
        sql`reminderSentAt IS NULL`
      ));

    for (const enr of enrollmentRows) {
      const studentResult = await db.select().from(students).where(eq(students.id, enr.studentId)).limit(1);
      if (studentResult[0]) {
        results.push({ ...enr, student: studentResult[0], class: cls });
      }
    }
  }
  return results;
}
