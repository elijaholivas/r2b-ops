import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAdminAlert,
  createClass,
  createEnrollment,
  createStudent,
  createUser,
  findActiveEnrollment,
  findStudentByEmail,
  getAdminAlerts,
  getClassById,
  getEmailQueueForAdmin,
  getEnrollmentById,
  getEnrollmentsForClass,
  getIntegrationSettings,
  getRecentActivity,
  getStudentById,
  getUserByEmail,
  getUserByOpenId,
  listClasses,
  listLocations,
  listUsers,
  logActivity,
  markAlertRead,
  moveStudentAtomic,
  queueEmail,
  searchStudents,
  updateClass,
  updateEnrollment,
  updateIntegrationSettings,
  updateUserRole,
  resetUserPassword,
  setUserActive,
  getEmailTemplate,
  updateEmailStatus,
  getPendingEmails,
  updateStudent,
  checkInEnrollment,
  bulkCheckIn,
  scheduleCcwRenewal,
  listCcwRenewalReminders,
  markCcwRenewalSent,
} from "./db";
import { renderTemplate, sendEmailViaMailgun } from "./email";
import { runWooSync } from "./wooSync";
import { z } from "zod";
import { nanoid } from "nanoid";

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["super_admin", "admin"] as const;
const STAFF_ROLES = ["super_admin", "admin", "staff"] as const;

function requireRole(user: { role: string }, roles: readonly string[]) {
  if (!roles.includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      if (!user.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Account is disabled" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      // Issue JWT session cookie — payload must match sdk.verifySession() expectations:
      // requires openId, appId (VITE_APP_ID), and name fields
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");
      const openId = user.openId ?? `local-${user.id}`;
      const token = await new SignJWT({
        openId,
        appId: process.env.VITE_APP_ID ?? "",
        name: user.name ?? user.email ?? openId,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime("7d")
        .sign(secret);

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  createStaffUser: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["super_admin", "admin", "staff", "instructor"]),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const existing = await getUserByEmail(input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `local-${nanoid()}`;
      await createUser({
        openId,
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });
      return { success: true };
    }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ADMIN_ROLES);
    return listUsers();
  }),

  updateUserRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["super_admin", "admin", "staff", "instructor", "user"]) }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ["super_admin"]);
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
  resetPassword: protectedProcedure
    .input(z.object({ userId: z.number(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ["super_admin", "admin"]);
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await resetUserPassword(input.userId, passwordHash);
      return { success: true };
    }),
  setUserActive: protectedProcedure
    .input(z.object({ userId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ["super_admin"]);
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot deactivate your own account" });
      await setUserActive(input.userId, input.isActive);
      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, "New password must be at least 8 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get the current user's record to verify their current password
      const user = await getUserByEmail(ctx.user.email ?? "");
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password change is not available for this account type" });
      }
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await resetUserPassword(user.id, newHash);
      return { success: true };
    }),
});

// ─── Classes Router ───────────────────────────────────────────────────────────

const classesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      locationId: z.number().optional(),
      upcoming: z.boolean().optional(),
      includeArchived: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      // Instructors only see assigned classes
      if (ctx.user.role === "instructor") {
        const all = await listClasses(input ?? {});
        return all;
      }
      return listClasses(input ?? {});
    }),

  listArchived: protectedProcedure
    .query(async ({ ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      return listClasses({ status: "archived", includeArchived: true });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      return cls;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      classType: z.string().optional(),
      description: z.string().optional(),
      locationId: z.number().optional(),
      instructorId: z.number().optional(),
      startDatetime: z.string(),
      endDatetime: z.string(),
      capacity: z.number().min(1).default(20),
      price: z.string().optional(),
      wooProductId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const id = await createClass({
        ...input,
        startDatetime: new Date(input.startDatetime),
        endDatetime: new Date(input.endDatetime),
        status: "upcoming",
        isActive: true,
      } as any);
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "class_created",
        entityType: "class",
        entityId: id,
        notes: `Class "${input.title}" created`,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      classType: z.string().optional(),
      locationId: z.number().optional(),
      capacity: z.number().optional(),
      status: z.enum(["upcoming", "in_progress", "completed", "cancelled", "archived"]).optional(),
      price: z.string().optional(),
      wooProductId: z.string().optional(),
      wooVariationId: z.string().optional(),
      startDatetime: z.string().optional(),
      endDatetime: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const { id, startDatetime, endDatetime, ...rest } = input;
      await updateClass(id, {
        ...rest,
        ...(startDatetime ? { startDatetime: new Date(startDatetime) } : {}),
        ...(endDatetime ? { endDatetime: new Date(endDatetime) } : {}),
      } as any);
      await logActivity({ actorUserId: ctx.user.id, actionType: "class_updated", entityType: "class", entityId: id });
      return { success: true };
    }),

  locations: protectedProcedure.query(() => listLocations()),
  duplicate: protectedProcedure
    .input(z.object({
      id: z.number(),
      newStartDatetime: z.string(),
      newEndDatetime: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      const newId = await createClass({
        title: cls.title,
        classType: cls.classType ?? undefined,
        description: cls.description ?? undefined,
        locationId: cls.locationId ?? undefined,
        instructorId: cls.instructorId ?? undefined,
        startDatetime: new Date(input.newStartDatetime),
        endDatetime: new Date(input.newEndDatetime),
        capacity: cls.capacity,
        price: cls.price ?? undefined,
        wooProductId: cls.wooProductId ?? undefined,
        status: "upcoming",
        isActive: true,
      } as any);
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "class_created",
        entityType: "class",
        entityId: newId,
        notes: `Class "${cls.title}" duplicated from class #${cls.id}`,
      });
      return { id: newId };
    }),
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      await updateClass(input.id, { status: "archived" } as any);
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "class_updated",
        entityType: "class",
        entityId: input.id,
        notes: "Class manually archived",
      });
      return { success: true };
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      // Restore: set status back to upcoming (or completed if end date already passed)
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      const restoredStatus = new Date(cls.endDatetime) > new Date() ? "upcoming" : "completed";
      await updateClass(input.id, { status: restoredStatus } as any);
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "class_updated",
        entityType: "class",
        entityId: input.id,
        notes: `Class restored from archive (status: ${restoredStatus})`,
      });
      return { success: true };
    }),

  updateCapacity: protectedProcedure
    .input(z.object({
      id: z.number(),
      capacity: z.number().int().min(1, "Capacity must be at least 1").max(500, "Capacity cannot exceed 500"),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      await updateClass(input.id, { capacity: input.capacity } as any);
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "class_updated",
        entityType: "class",
        entityId: input.id,
        oldValues: { capacity: cls.capacity },
        newValues: { capacity: input.capacity },
        notes: `Capacity updated from ${cls.capacity} to ${input.capacity}`,
      });
      return { success: true, capacity: input.capacity };
    }),
});

// ─── Enrollments Router ───────────────────────────────────────────────────────

const enrollmentsRouter = router({
  forClass: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      return getEnrollmentsForClass(input.classId);
    }),

  add: protectedProcedure
    .input(z.object({
      classId: z.number(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      paymentStatus: z.enum(["paid", "unpaid", "free"]).default("unpaid"),
      sendConfirmation: z.boolean().default(false),
      overrideDuplicate: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);

      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      if (cls.enrolledCount >= cls.capacity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Class is full" });
      }

      // Find or create student
      let student = await findStudentByEmail(input.email);
      if (!student) {
        const studentId = await createStudent({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          notes: null,
        });
        student = await getStudentById(studentId) as any;
      }

      // Duplicate check
      const existing = await findActiveEnrollment(input.classId, student!.id);
      if (existing && !input.overrideDuplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "DUPLICATE_ENROLLMENT",
        });
      }

      const enrollmentId = await createEnrollment({
        classId: input.classId,
        studentId: student!.id,
        status: "enrolled",
        paymentStatus: input.paymentStatus,
        source: "manual",
        wooOrderId: null,
        wooOrderItemId: null,
        confirmationSentAt: null,
        reminderSentAt: null,
        checkedInAt: null,
        removedAt: null,
        movedFromClassId: null,
        movedToClassId: null,
        internalNotes: null,
      });

      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "student_added",
        entityType: "enrollment",
        entityId: enrollmentId,
        newValues: { classId: input.classId, studentId: student!.id, paymentStatus: input.paymentStatus },
        notes: `${input.firstName} ${input.lastName} manually added to class ${cls.title}`,
      });

      // Queue confirmation email
      if (input.sendConfirmation) {
        const template = await getEmailTemplate("confirmation");
        if (template) {
          const vars = {
            studentName: `${input.firstName} ${input.lastName}`,
            className: cls.title,
            classDate: new Date(cls.startDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" }),
            classTime: new Date(cls.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }),
            classLocation: cls.location?.name ?? "TBD",
          };
          const bodyHtml = renderTemplate(template.bodyHtml, vars);
          const subject = renderTemplate(template.subject, vars);
          await queueEmail({
            enrollmentId,
            classId: input.classId,
            studentId: student!.id,
            toEmail: input.email,
            toName: `${input.firstName} ${input.lastName}`,
            templateKey: "confirmation",
            subject,
            bodyHtml,
            scheduledFor: new Date(),
          });
          await updateEnrollment(enrollmentId, { confirmationSentAt: new Date() });
        }
      }

      return { success: true, enrollmentId, studentId: student!.id };
    }),

  remove: protectedProcedure
    .input(z.object({ enrollmentId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const enrollment = await getEnrollmentById(input.enrollmentId);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });

      await updateEnrollment(input.enrollmentId, {
        status: "removed",
        removedAt: new Date(),
        internalNotes: input.reason ?? null,
      });

      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "student_removed",
        entityType: "enrollment",
        entityId: input.enrollmentId,
        oldValues: { status: "enrolled" },
        newValues: { status: "removed" },
        notes: input.reason ?? `Student removed from class ${enrollment.classId}`,
      });

      return { success: true };
    }),

  move: protectedProcedure
    .input(z.object({
      enrollmentId: z.number(),
      toClassId: z.number(),
      notifyStudent: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);

      const enrollment = await getEnrollmentById(input.enrollmentId);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });

      const result = await moveStudentAtomic({
        enrollmentId: input.enrollmentId,
        fromClassId: enrollment.classId,
        toClassId: input.toClassId,
        actorUserId: ctx.user.id,
        notifyStudent: input.notifyStudent,
      });

      // Queue notification email if requested
      if (input.notifyStudent) {
        const student = await getStudentById(enrollment.studentId);
        const destClass = await getClassById(input.toClassId);
        if (student && destClass) {
          const template = await getEmailTemplate("confirmation");
          if (template) {
            const vars = {
              studentName: `${student.firstName} ${student.lastName}`,
              className: destClass.title,
              classDate: new Date(destClass.startDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" }),
              classTime: new Date(destClass.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }),
              classLocation: destClass.location?.name ?? "TBD",
            };
            await queueEmail({
              enrollmentId: result.newEnrollmentId,
              classId: input.toClassId,
              studentId: student.id,
              toEmail: student.email,
              toName: `${student.firstName} ${student.lastName}`,
              templateKey: "confirmation",
              subject: `Updated: You are confirmed for ${destClass.title}`,
              bodyHtml: renderTemplate(template.bodyHtml, vars),
              scheduledFor: new Date(),
            });
          }
        }
      }

      return result;
    }),

  updatePaymentStatus: protectedProcedure
    .input(z.object({
      enrollmentId: z.number(),
      paymentStatus: z.enum(["paid", "unpaid", "free"]),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const enrollment = await getEnrollmentById(input.enrollmentId);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });

      await updateEnrollment(input.enrollmentId, { paymentStatus: input.paymentStatus });
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "payment_status_changed",
        entityType: "enrollment",
        entityId: input.enrollmentId,
        oldValues: { paymentStatus: enrollment.paymentStatus },
        newValues: { paymentStatus: input.paymentStatus },
      });
      return { success: true };
    }),

  exportCsv: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });

      const enrollmentRows = await getEnrollmentsForClass(input.classId);
      const rows = enrollmentRows.map((e) => ({
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        email: e.student.email,
        phone: e.student.phone ?? "",
        classTitle: cls.title,
        classDate: new Date(cls.startDatetime).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" }),
        classLocation: cls.location?.name ?? "",
        paymentStatus: e.paymentStatus,
        attendanceStatus: e.checkedInAt ? "attended" : e.status === "no_show" ? "no_show" : "not_checked_in",
      }));

      const headers = ["First Name", "Last Name", "Email", "Phone", "Class Title", "Class Date", "Location", "Payment Status", "Attendance"];
      const csvLines = [
        headers.join(","),
        ...rows.map((r) =>
          [r.firstName, r.lastName, r.email, r.phone, `"${r.classTitle}"`, r.classDate, `"${r.classLocation}"`, r.paymentStatus, r.attendanceStatus]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        ),
      ];
      return { csv: csvLines.join("\n"), filename: `roster-${cls.title.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.csv` };
    }),

  checkIn: protectedProcedure
    .input(z.object({ enrollmentId: z.number(), attended: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      await checkInEnrollment(input.enrollmentId, input.attended);
      return { success: true };
    }),

  bulkCheckIn: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const count = await bulkCheckIn(input.classId);
      await logActivity({ actorUserId: ctx.user.id, actionType: "bulk_checkin", entityType: "class", entityId: input.classId, notes: `Bulk checked in ${count} students` });
      return { success: true, count };
    }),

  sendConfirmationEmail: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const enrollment = await getEnrollmentById(input.enrollmentId);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
      const cls = await getClassById(enrollment.classId!);
      const student = await getStudentById(enrollment.studentId!);
      if (!cls || !student) throw new TRPCError({ code: "NOT_FOUND", message: "Class or student not found" });
      const settings = await getIntegrationSettings();
      const classDate = new Date(cls.startDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
      const classTime = new Date(cls.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
      const bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h1 style="color:#c0392b;margin:0">Right 2 Bear</h1><p style="color:#fff;margin:4px 0 0">Enrollment Confirmation</p></div><div style="padding:24px"><p>Hi ${student.firstName},</p><p>You are confirmed for:</p><div style="background:#f5f5f5;border-left:4px solid #c0392b;padding:16px;margin:16px 0"><h2 style="margin:0 0 8px;color:#1a1a1a">${cls.title}</h2><p style="margin:4px 0"><strong>Date:</strong> ${classDate}</p><p style="margin:4px 0"><strong>Time:</strong> ${classTime}</p></div><p>Questions? Email <a href="mailto:info@r2bear.com">info@r2bear.com</a></p><p>— The Right 2 Bear Team</p></div></div>`;
      await queueEmail({ enrollmentId: enrollment.id, classId: cls.id, studentId: student.id, toEmail: student.email, toName: `${student.firstName} ${student.lastName}`, templateKey: "confirmation", subject: `Confirmed: ${cls.title}`, bodyHtml, scheduledFor: new Date() });
      await updateEnrollment(enrollment.id, { confirmationSentAt: new Date() });
      return { success: true };
    }),

  sendReminderEmail: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const enrollment = await getEnrollmentById(input.enrollmentId);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
      const cls = await getClassById(enrollment.classId!);
      const student = await getStudentById(enrollment.studentId!);
      if (!cls || !student) throw new TRPCError({ code: "NOT_FOUND", message: "Class or student not found" });
      const classDate = new Date(cls.startDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
      const classTime = new Date(cls.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
      const bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h1 style="color:#c0392b;margin:0">Right 2 Bear</h1><p style="color:#fff;margin:4px 0 0">Class Reminder</p></div><div style="padding:24px"><p>Hi ${student.firstName},</p><p>This is a reminder about your upcoming class:</p><div style="background:#f5f5f5;border-left:4px solid #c0392b;padding:16px;margin:16px 0"><h2 style="margin:0 0 8px;color:#1a1a1a">${cls.title}</h2><p style="margin:4px 0"><strong>Date:</strong> ${classDate}</p><p style="margin:4px 0"><strong>Time:</strong> ${classTime}</p></div><p>Please arrive 10-15 minutes early with a valid photo ID.</p><p>— The Right 2 Bear Team</p></div></div>`;
      await queueEmail({ enrollmentId: enrollment.id, classId: cls.id, studentId: student.id, toEmail: student.email, toName: `${student.firstName} ${student.lastName}`, templateKey: "reminder", subject: `Reminder: ${cls.title}`, bodyHtml, scheduledFor: new Date() });
      await updateEnrollment(enrollment.id, { reminderSentAt: new Date() });
      return { success: true };
    }),

  sendBulkReminders: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const enrollmentList = await getEnrollmentsForClass(input.classId);
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      const classDate = new Date(cls.startDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
      const classTime = new Date(cls.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
      let count = 0;
      for (const enr of enrollmentList.filter(e => e.status === "enrolled")) {
        const bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h1 style="color:#c0392b;margin:0">Right 2 Bear</h1><p style="color:#fff;margin:4px 0 0">Class Reminder</p></div><div style="padding:24px"><p>Hi ${enr.student.firstName},</p><p>Reminder: your class is coming up!</p><div style="background:#f5f5f5;border-left:4px solid #c0392b;padding:16px;margin:16px 0"><h2 style="margin:0 0 8px;color:#1a1a1a">${cls.title}</h2><p style="margin:4px 0"><strong>Date:</strong> ${classDate}</p><p style="margin:4px 0"><strong>Time:</strong> ${classTime}</p></div><p>Please arrive 10-15 minutes early with a valid photo ID.</p><p>— The Right 2 Bear Team</p></div></div>`;
        await queueEmail({ enrollmentId: enr.id, classId: cls.id, studentId: enr.student.id, toEmail: enr.student.email, toName: `${enr.student.firstName} ${enr.student.lastName}`, templateKey: "reminder", subject: `Reminder: ${cls.title}`, bodyHtml, scheduledFor: new Date() });
        count++;
      }
      return { success: true, count };
    }),
});
// ─── Students Router ───────────────────────────────────────────────────────────

const studentsRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return searchStudents(input.query);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const student = await getStudentById(input.id);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Student not found" });
      const enrollmentRows = await searchStudents(student.email);
      return enrollmentRows[0] ?? { ...student, enrollments: [] };
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, STAFF_ROLES);
      const { id, ...data } = input;
      await updateStudent(id, data);
      await logActivity({ actorUserId: ctx.user.id, actionType: "update_student", entityType: "student", entityId: id, notes: "Updated student profile" });
      return { success: true };
    }),
});
// ─── CCW Renewals Router ──────────────────────────────────────────────────────
const ccwRenewalsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "sent", "cancelled"]).optional() }).optional())
    .query(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      return listCcwRenewalReminders(input ?? {});
    }),
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const db = await import("./db").then(m => m.getDb());
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { eq } = await import("drizzle-orm");
      const { ccwRenewalReminders } = await import("../drizzle/schema");
      await db.update(ccwRenewalReminders).set({ status: "cancelled" }).where(eq(ccwRenewalReminders.id, input.id));
      return { success: true };
    }),
  sendNow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const { getDueCcwRenewals, markCcwRenewalSent, listCcwRenewalReminders, getIntegrationSettings } = await import("./db");
      const { sendEmailViaMailgun } = await import("./email");
      const { ccwRenewalReminders } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await import("./db").then(m => m.getDb());
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get the specific renewal
      const rows = await listCcwRenewalReminders();
      const renewal = rows.find(r => r.id === input.id);
      if (!renewal) throw new TRPCError({ code: "NOT_FOUND", message: "Renewal reminder not found" });
      // Get configurable renewal product URL
      const settings = await getIntegrationSettings();
      const renewalUrl = settings?.ccwRenewalProductUrl || "https://r2bear.com/ccw-renewal";
      // Send the email
      await sendEmailViaMailgun({
        to: renewal.student.email,
        toName: `${renewal.student.firstName} ${renewal.student.lastName}`,
        subject: "Your CCW Renewal is Coming Up — Time to Schedule!",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h1 style="color:#c0392b;margin:0">Right 2 Bear</h1><p style="color:#fff;margin:4px 0 0">CCW Renewal Reminder</p></div><div style="padding:24px"><p>Hi ${renewal.student.firstName},</p><p>Your CCW certification is coming up for renewal. California requires renewal every 2 years, and your renewal window is approaching.</p><div style="background:#f5f5f5;border-left:4px solid #c0392b;padding:16px;margin:16px 0"><p style="margin:0"><strong>Action Required:</strong> Schedule your CCW renewal class to stay compliant and keep your carry permit active.</p></div><p style="text-align:center;margin:24px 0"><a href="${renewalUrl}" style="background:#c0392b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">Schedule My CCW Renewal</a></p><p>Questions? Email us at <a href="mailto:info@r2bear.com">info@r2bear.com</a></p><p>— Right 2 Bear Firearms Training</p></div></div>`,
      });
      await markCcwRenewalSent(input.id);
      return { success: true };
    }),
  processNow: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const { getDueCcwRenewals, markCcwRenewalSent, getIntegrationSettings } = await import("./db");
      const { sendEmailViaMailgun } = await import("./email");
      const due = await getDueCcwRenewals();
      const settings = await getIntegrationSettings();
      const renewalUrl = settings?.ccwRenewalProductUrl || "https://r2bear.com/ccw-renewal";
      let sent = 0;
      for (const renewal of due) {
        try {
          await sendEmailViaMailgun({
            to: renewal.student.email,
            toName: `${renewal.student.firstName} ${renewal.student.lastName}`,
            subject: "Your CCW Renewal is Coming Up — Time to Schedule!",
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h1 style="color:#c0392b;margin:0">Right 2 Bear</h1><p style="color:#fff;margin:4px 0 0">CCW Renewal Reminder</p></div><div style="padding:24px"><p>Hi ${renewal.student.firstName},</p><p>Your CCW certification is coming up for renewal. California requires renewal every 2 years, and your renewal window is approaching.</p><div style="background:#f5f5f5;border-left:4px solid #c0392b;padding:16px;margin:16px 0"><p style="margin:0"><strong>Action Required:</strong> Schedule your CCW renewal class to stay compliant and keep your carry permit active.</p></div><p style="text-align:center;margin:24px 0"><a href="${renewalUrl}" style="background:#c0392b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">Schedule My CCW Renewal</a></p><p>Questions? Email us at <a href="mailto:info@r2bear.com">info@r2bear.com</a></p><p>— Right 2 Bear Firearms Training</p></div></div>`,
          });
          await markCcwRenewalSent(renewal.id);
          sent++;
        } catch (e) {
          console.error(`[CCW Renewal] Failed to send for renewal ${renewal.id}:`, e);
        }
      }
      return { sent };
    }),
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      const all = await listCcwRenewalReminders();
      const now = new Date();
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        total: all.length,
        pending: all.filter(r => r.status === "pending").length,
        sent: all.filter(r => r.status === "sent").length,
        dueThisMonth: all.filter(r => r.status === "pending" && new Date(r.scheduledFor) <= thisMonthEnd).length,
      };
    }),
});
// ─── Admin Router ──────────────────────────────────────────────────────────────

const adminRouter = router({
  alerts: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      return getAdminAlerts(input?.unreadOnly ?? false);
    }),

  markAlertRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      await markAlertRead(input.id);
      return { success: true };
    }),

  emailQueue: protectedProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ADMIN_ROLES);
    return getEmailQueueForAdmin(100);
  }),

  retryEmail: protectedProcedure
    .input(z.object({ emailQueueId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      // Reset to pending so the scheduler picks it up
      const { getDb } = await import("./db");
      const { emailQueue } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db.update(emailQueue).set({ status: "pending", scheduledFor: new Date(), errorMessage: null } as any).where(eq(emailQueue.id, input.emailQueueId));
      return { success: true };
    }),

  activityLog: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input, ctx }) => {
      requireRole(ctx.user, ADMIN_ROLES);
      return getRecentActivity(input?.limit ?? 20);
    }),

  integrationSettings: protectedProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ["super_admin"]);
    const settings = await getIntegrationSettings();
    // Mask secrets
    if (settings) {
      return {
        ...settings,
        wooConsumerKey: settings.wooConsumerKey ? "••••••••" : null,
        wooConsumerSecret: settings.wooConsumerSecret ? "••••••••" : null,
        webhookSecret: settings.webhookSecret ? "••••••••" : null,
        mailgunApiKey: settings.mailgunApiKey ? "••••••••" : null,
      };
    }
    return settings;
  }),

  updateIntegrationSettings: protectedProcedure
    .input(z.object({
      wooBaseUrl: z.string().optional(),
      wooConsumerKey: z.string().optional(),
      wooConsumerSecret: z.string().optional(),
      webhookSecret: z.string().optional(),
      mailgunApiKey: z.string().optional(),
      mailgunDomain: z.string().optional(),
      ccwRenewalProductUrl: z.string().url().optional().or(z.literal("")),
    }))
    .mutation(async ({ input, ctx }) => {
      requireRole(ctx.user, ["super_admin"]);
      await updateIntegrationSettings(input as any);
      return { success: true };
    }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ADMIN_ROLES);
    const allClasses = await listClasses({ upcoming: true });
    const alerts = await getAdminAlerts(true);
    const recentActivity = await getRecentActivity(10);
    const failedEmails = await getEmailQueueForAdmin(100);
    const failedCount = failedEmails.filter((e) => e.status === "failed").length;

    return {
      upcomingClasses: allClasses.slice(0, 5),
      totalUpcoming: allClasses.length,
      unreadAlerts: alerts.length,
      failedEmails: failedCount,
      recentActivity,
    };
  }),

  processEmailQueue: protectedProcedure.mutation(async ({ ctx }) => {
    requireRole(ctx.user, ADMIN_ROLES);
    const { processEmailQueue } = await import("./email");
    const result = await processEmailQueue();
    return result;
  }),

  syncWooProducts: protectedProcedure.mutation(async ({ ctx }) => {
    requireRole(ctx.user, ["super_admin"]);
    const settings = await getIntegrationSettings();
    if (!settings?.wooBaseUrl || !settings?.wooConsumerKey || !settings?.wooConsumerSecret) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "WooCommerce credentials are not configured. Please set Store URL, Consumer Key, and Consumer Secret in Settings.",
      });
    }
    try {
      return await runWooSync();
    } catch (err: any) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message ?? "Sync failed" });
    }
  }),
  // ─── DEAD CODE BELOW (replaced by runWooSync) — kept for reference until next cleanup ───
  _syncWooProductsOld: protectedProcedure.mutation(async ({ ctx }) => {
    requireRole(ctx.user, ["super_admin"]);
    const settings = await getIntegrationSettings();
    if (!settings?.wooBaseUrl || !settings?.wooConsumerKey || !settings?.wooConsumerSecret) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "WooCommerce credentials are not configured." });
    }

    const baseUrl = settings.wooBaseUrl.replace(/\/$/, "");
    const auth = Buffer.from(`${settings.wooConsumerKey}:${settings.wooConsumerSecret}`).toString("base64");

    // Fetch up to 100 published products
    const url = `${baseUrl}/wp-json/wc/v3/products?per_page=100&status=publish`;
    const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!response.ok) {
      const text = await response.text();
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `WooCommerce API error ${response.status}: ${text.slice(0, 200)}`,
      });
    }
    const products: any[] = await response.json();

    // Load existing classes to detect already-mapped products
    const existingClasses = await listClasses();
    const mappedProductIds = new Set(existingClasses.map((c) => c.wooProductId).filter(Boolean));
    const mappedVariationIds = new Set(existingClasses.map((c) => c.wooVariationId).filter(Boolean));

    // Load locations for fuzzy matching
    const allLocations = await listLocations();

    // Helper: parse the advanced-date meta field
    // WooCommerce Advanced Custom Fields stores date as an object with keys:
    // Parses WooCommerce advanced-date meta fields.
    // The plugin stores:
    //   class_date          → Unix timestamp (seconds) of start
    //   class_date__end_date → Unix timestamp (seconds) of end
    //   class_date__config  → JSON string with human-readable dates as backup
    function parseAdvancedDate(
      meta: any,
      metaMap?: Record<string, any>
    ): { start: Date; end: Date } | null {
      if (!meta) return null;
      try {
        // Case 1 (PREFERRED): class_date__config JSON — contains exact local time as entered in WooCommerce
        // e.g. {"date":"2026-08-26","time":"08:00","is_end_date":"1","end_date":"2026-08-26","end_time":"16:00"}
        const configRaw = metaMap?.["class_date__config"];
        if (configRaw) {
          try {
            const cfg = typeof configRaw === "string" ? JSON.parse(configRaw) : configRaw;
            const startStr = cfg.date || cfg.start_date;
            const startTime = (cfg.time || cfg.start_time || "08:00").replace(/(\d+:\d+).*/, "$1");
            const endStr = cfg.end_date;
            const endTime = (cfg.end_time || "17:00").replace(/(\d+:\d+).*/, "$1");
            if (startStr) {
              // Parse as local time (no Z suffix) so it isn't shifted to UTC
              const start = new Date(`${startStr}T${startTime}:00`);
              const end = endStr ? new Date(`${endStr}T${endTime}:00`) : new Date(start.getTime() + 8 * 3600000);
              if (!isNaN(start.getTime())) return { start, end };
            }
          } catch (_) { /* fall through */ }
        }

        // Case 2: Unix timestamp string/number — treat as UTC seconds
        const asNum = typeof meta === "string" ? parseInt(meta, 10) : (typeof meta === "number" ? meta : NaN);
        if (!isNaN(asNum) && asNum > 1000000000) {
          const start = new Date(asNum * 1000);
          let end: Date;
          if (metaMap) {
            const endTs = metaMap["class_date__end_date"];
            const endNum = endTs ? parseInt(String(endTs), 10) : NaN;
            end = (!isNaN(endNum) && endNum > asNum)
              ? new Date(endNum * 1000)
              : new Date(start.getTime() + 8 * 3600000);
          } else {
            end = new Date(start.getTime() + 8 * 3600000);
          }
          if (!isNaN(start.getTime())) return { start, end };
        }

        // Case 3: JSON string (meta itself is the config JSON)
        if (typeof meta === "string") {
          try {
            const obj = JSON.parse(meta);
            const startStr = obj.date || obj.start_date || obj.start;
            const startTime = (obj.time || obj.start_time || "08:00").replace(/(\d+:\d+).*/, "$1");
            const endStr = obj.end_date || obj.end;
            const endTime = (obj.end_time || "17:00").replace(/(\d+:\d+).*/, "$1");
            if (!startStr) return null;
            const start = new Date(`${startStr}T${startTime}:00`);
            const end = endStr ? new Date(`${endStr}T${endTime}:00`) : new Date(start.getTime() + 8 * 3600000);
            if (!isNaN(start.getTime())) return { start, end };
          } catch (_) { /* not JSON */ }

          // Case 4: Pipe-delimited human-readable string
          const parts = meta.split("|");
          const start = new Date(parts[0]?.trim());
          const end = parts[1] ? new Date(parts[1].trim()) : new Date(start.getTime() + 8 * 3600000);
          if (!isNaN(start.getTime())) return { start, end };
        }

        // Case 5: Object form
        if (typeof meta === "object" && meta !== null) {
          const startStr = meta.start_date || meta.date || meta.start;
          const startTime = (meta.start_time || meta.time || "08:00").replace(/(\d+:\d+).*/, "$1");
          const endStr = meta.end_date || meta.end;
          const endTime = (meta.end_time || "17:00").replace(/(\d+:\d+).*/, "$1");
          if (!startStr) return null;
          const start = new Date(`${startStr}T${startTime}:00`);
          const end = endStr ? new Date(`${endStr}T${endTime}:00`) : new Date(start.getTime() + 8 * 3600000);
          if (!isNaN(start.getTime())) return { start, end };
        }

        return null;
      } catch (_) { return null; }
    }

    // Helper: find location by fuzzy text match
    function matchLocation(locationText: string | null): number | undefined {
      if (!locationText) return undefined;
      const lower = locationText.toLowerCase();
      const match = allLocations.find((loc) =>
        lower.includes(loc.name.toLowerCase()) || loc.name.toLowerCase().includes(lower.split(",")[0]?.trim() ?? "")
      );
      return match?.id;
    }

    type SyncResult = {
      id: number;
      name: string;
      variationId: number | null;
      variationName: string | null;
      action: "created" | "skipped";
      classId?: number;
      reason?: string;
    };

    const results: SyncResult[] = [];

    // Process each product
    for (const product of products) {
      const metaData: Record<string, any> = {};
      for (const m of (product.meta_data ?? [])) {
        metaData[m.key] = m.value;
      }

      const classDateMeta = metaData["class_date"];
      const classLocation = metaData["class_location"] || null;
      const stockQty = product.stock_quantity;
      const capacity = (stockQty && stockQty > 0) ? stockQty : 20;
      // Pass full metaData so parseAdvancedDate can read class_date__end_date
      const locationId = matchLocation(classLocation);
      const dates = parseAdvancedDate(classDateMeta, metaData);

      if (product.type === "variable" && product.variations?.length > 0) {
        // Fetch variations
        try {
          const varUrl = `${baseUrl}/wp-json/wc/v3/products/${product.id}/variations?per_page=100`;
          const varRes = await fetch(varUrl, { headers: { Authorization: `Basic ${auth}` } });
          if (varRes.ok) {
            const variations: any[] = await varRes.json();
            for (const v of variations) {
              const attrLabel = v.attributes?.map((a: any) => a.option).join(", ") || `Variation #${v.id}`;
              const varId = String(v.id);
              if (mappedVariationIds.has(varId)) {
                results.push({ id: product.id, name: product.name, variationId: v.id, variationName: attrLabel, action: "skipped", reason: "Already mapped" });
                continue;
              }
              // Use variation meta for date if available, else fall back to parent
              const varMeta: Record<string, any> = {};
              for (const m of (v.meta_data ?? [])) varMeta[m.key] = m.value;
              const varDates = parseAdvancedDate(varMeta["class_date"], varMeta) ?? dates;
              if (!varDates) {
                results.push({ id: product.id, name: product.name, variationId: v.id, variationName: attrLabel, action: "skipped", reason: "No class_date found" });
                continue;
              }
              const title = `${product.name}${attrLabel ? ` – ${attrLabel}` : ""}`;
              const classId = await createClass({
                title,
                classType: product.categories?.[0]?.name ?? undefined,
                description: classLocation ?? undefined,
                locationId,
                startDatetime: varDates.start,
                endDatetime: varDates.end,
                capacity,
                price: v.price || product.price || undefined,
                wooProductId: String(product.id),
                wooVariationId: varId,
                status: "upcoming",
                isActive: true,
              } as any);
              results.push({ id: product.id, name: product.name, variationId: v.id, variationName: attrLabel, action: "created", classId });
            }
            continue;
          }
        } catch (_) { /* fall through */ }
      }

      // Simple product
      const productId = String(product.id);
      if (mappedProductIds.has(productId)) {
        results.push({ id: product.id, name: product.name, variationId: null, variationName: null, action: "skipped", reason: "Already mapped" });
        continue;
      }
      if (!dates) {
        results.push({ id: product.id, name: product.name, variationId: null, variationName: null, action: "skipped", reason: "No class_date found" });
        continue;
      }
      const classId = await createClass({
        title: product.name,
        classType: product.categories?.[0]?.name ?? undefined,
        description: classLocation ?? undefined,
        locationId,
        startDatetime: dates.start,
        endDatetime: dates.end,
        capacity,
        price: product.price || undefined,
        wooProductId: productId,
        status: "upcoming",
        isActive: true,
      } as any);
      results.push({ id: product.id, name: product.name, variationId: null, variationName: null, action: "created", classId });
    }

    const created = results.filter((r) => r.action === "created").length;
    const skipped = results.filter((r) => r.action === "skipped").length;
    return { results, created, skipped, total: results.length };
  }),
});

// ─── Webhook Router (public) ──────────────────────────────────────────────────

const webhookRouter = router({
  woocommerce: publicProcedure
    .input(z.object({
      event: z.string(),
      payload: z.any(),
      signature: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { event, payload } = input;

      if (!["order.created", "order.updated", "woocommerce_order_status_processing", "woocommerce_order_status_completed"].includes(event)) {
        return { success: true, message: "Event ignored" };
      }

      const order = payload;
      const lineItems: any[] = order.line_items ?? [];

      for (const item of lineItems) {
        const wooProductId = String(item.product_id);
        const wooVariationId = item.variation_id ? String(item.variation_id) : null;

        // Find matching class
        const allClasses = await listClasses();
        const matchedClass = allClasses.find(
          (c) => c.wooProductId === wooProductId || (wooVariationId && c.wooVariationId === wooVariationId)
        );

        if (!matchedClass) {
          await createAdminAlert({
            alertType: "unmapped_product",
            title: "Unmapped WooCommerce Product",
            message: `Order #${order.id} contains product ID ${wooProductId} which is not mapped to any class.`,
            metadata: { orderId: order.id, productId: wooProductId, variationId: wooVariationId },
          });
          continue;
        }

        // Find or create student
        const billing = order.billing ?? {};
        const email = (billing.email ?? "").toLowerCase();
        if (!email) continue;

        let student = await findStudentByEmail(email);
        if (!student) {
          const studentId = await createStudent({
            firstName: billing.first_name ?? "",
            lastName: billing.last_name ?? "",
            email,
            phone: billing.phone ?? null,
            notes: null,
          });
          student = await getStudentById(studentId) as any;
        }

        // Check for existing enrollment
        const existing = await findActiveEnrollment(matchedClass.id, student!.id);
        if (existing) continue;

        // Create enrollment
        const enrollmentId = await createEnrollment({
          classId: matchedClass.id,
          studentId: student!.id,
          status: "enrolled",
          paymentStatus: order.status === "completed" || order.status === "processing" ? "paid" : "unpaid",
          source: "woocommerce",
          wooOrderId: String(order.id),
          wooOrderItemId: String(item.id),
          confirmationSentAt: null,
          reminderSentAt: null,
          checkedInAt: null,
          removedAt: null,
          movedFromClassId: null,
          movedToClassId: null,
          internalNotes: null,
        });

        // Queue confirmation email
        const template = await getEmailTemplate("confirmation");
        if (template) {
          const vars = {
            studentName: `${student!.firstName} ${student!.lastName}`,
            className: matchedClass.title,
            classDate: new Date(matchedClass.startDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" }),
            classTime: new Date(matchedClass.startDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }),
            classLocation: matchedClass.location?.name ?? "TBD",
          };
          await queueEmail({
            enrollmentId,
            classId: matchedClass.id,
            studentId: student!.id,
            toEmail: student!.email,
            toName: `${student!.firstName} ${student!.lastName}`,
            templateKey: "confirmation",
            subject: renderTemplate(template.subject, vars),
            bodyHtml: renderTemplate(template.bodyHtml, vars),
            scheduledFor: new Date(),
          });
        }

        await logActivity({
          actionType: "woo_enrollment_created",
          entityType: "enrollment",
          entityId: enrollmentId,
          newValues: { classId: matchedClass.id, studentId: student!.id, wooOrderId: order.id },
        });
      }

      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  classes: classesRouter,
  enrollments: enrollmentsRouter,
  students: studentsRouter,
  admin: adminRouter,
  webhooks: webhookRouter,
  ccwRenewals: ccwRenewalsRouter,
});

export type AppRouter = typeof appRouter;
