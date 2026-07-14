import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["super_admin", "admin", "staff", "instructor", "user"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Locations ────────────────────────────────────────────────────────────────

export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address1: varchar("address1", { length: 255 }),
  address2: varchar("address2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  timezone: varchar("timezone", { length: 64 }).default("America/Los_Angeles").notNull(),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

// ─── Classes ──────────────────────────────────────────────────────────────────

export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  classType: varchar("classType", { length: 100 }),
  description: text("description"),
  locationId: int("locationId"),
  instructorId: int("instructorId"),
  startDatetime: timestamp("startDatetime").notNull(),
  endDatetime: timestamp("endDatetime").notNull(),
  capacity: int("capacity").default(20).notNull(),
  status: mysqlEnum("status", ["upcoming", "in_progress", "completed", "cancelled", "archived"]).default("upcoming").notNull(),
  wooProductId: varchar("wooProductId", { length: 64 }),
  wooVariationId: varchar("wooVariationId", { length: 64 }),
  price: varchar("price", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

// ─── Students ─────────────────────────────────────────────────────────────────

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ─── Enrollments ──────────────────────────────────────────────────────────────

export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  studentId: int("studentId").notNull(),
  status: mysqlEnum("status", ["enrolled", "moved", "removed", "cancelled", "attended", "no_show"]).default("enrolled").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["paid", "unpaid", "free"]).default("unpaid").notNull(),
  source: mysqlEnum("source", ["woocommerce", "manual", "import"]).default("manual").notNull(),
  wooOrderId: varchar("wooOrderId", { length: 64 }),
  wooOrderItemId: varchar("wooOrderItemId", { length: 64 }),
  confirmationSentAt: timestamp("confirmationSentAt"),
  reminderSentAt: timestamp("reminderSentAt"),
  checkedInAt: timestamp("checkedInAt"),
  removedAt: timestamp("removedAt"),
  movedFromClassId: int("movedFromClassId"),
  movedToClassId: int("movedToClassId"),
  internalNotes: text("internalNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

// ─── Class Staff ──────────────────────────────────────────────────────────────

export const classStaff = mysqlTable("classStaff", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  userId: int("userId").notNull(),
  roleOnClass: varchar("roleOnClass", { length: 50 }).default("instructor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClassStaff = typeof classStaff.$inferSelect;

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const activityLog = mysqlTable("activityLog", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  actionType: varchar("actionType", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId"),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;

// ─── Email Templates ──────────────────────────────────────────────────────────

export const emailTemplates = mysqlTable("emailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  templateKey: varchar("templateKey", { length: 100 }).notNull().unique(),
  subject: varchar("subject", { length: 255 }).notNull(),
  bodyHtml: text("bodyHtml").notNull(),
  bodyText: text("bodyText"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;

// ─── Email Queue ──────────────────────────────────────────────────────────────

export const emailQueue = mysqlTable("emailQueue", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollmentId"),
  classId: int("classId"),
  studentId: int("studentId"),
  toEmail: varchar("toEmail", { length: 320 }).notNull(),
  toName: varchar("toName", { length: 255 }),
  templateKey: varchar("templateKey", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  bodyHtml: text("bodyHtml"),
  scheduledFor: timestamp("scheduledFor").notNull(),
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailQueueItem = typeof emailQueue.$inferSelect;

// ─── Integration Settings ─────────────────────────────────────────────────────

export const integrationSettings = mysqlTable("integrationSettings", {
  id: int("id").autoincrement().primaryKey(),
  wooBaseUrl: varchar("wooBaseUrl", { length: 255 }),
  wooConsumerKey: varchar("wooConsumerKey", { length: 255 }),
  wooConsumerSecret: varchar("wooConsumerSecret", { length: 255 }),
  webhookSecret: varchar("webhookSecret", { length: 255 }),
  mailgunApiKey: varchar("mailgunApiKey", { length: 255 }),
  mailgunDomain: varchar("mailgunDomain", { length: 255 }).default("mail.r2bear.com"),
  defaultFromEmail: varchar("defaultFromEmail", { length: 320 }).default("info@mail.r2bear.com"),
  defaultReplyTo: varchar("defaultReplyTo", { length: 320 }).default("info@r2bear.com"),
  ccwRenewalProductUrl: varchar("ccwRenewalProductUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationSettings = typeof integrationSettings.$inferSelect;

// ─── Admin Alerts ─────────────────────────────────────────────────────────────

export const adminAlerts = mysqlTable("adminAlerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: varchar("alertType", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  metadata: json("metadata"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAlert = typeof adminAlerts.$inferSelect;

// ─── CCW Renewal Reminders ────────────────────────────────────────────────────
export const ccwRenewalReminders = mysqlTable("ccwRenewalReminders", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollmentId").notNull(),
  studentId: int("studentId").notNull(),
  classId: int("classId").notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(), // 18 months after class date
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "cancelled"]).default("pending").notNull(),
  emailQueueId: int("emailQueueId"), // reference to the queued email
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CcwRenewalReminder = typeof ccwRenewalReminders.$inferSelect;

// ─── Push Subscriptions ───────────────────────────────────────────────────────

export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
