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
  getEmailTemplate,
  updateEmailStatus,
  getPendingEmails,
} from "./db";
import { renderTemplate, sendEmailViaMailgun } from "./email";
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

      // Issue JWT session cookie
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");
      const token = await new SignJWT({ userId: user.id, role: user.role, openId: user.openId ?? `local-${user.id}` })
        .setProtectedHeader({ alg: "HS256" })
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
});

// ─── Classes Router ───────────────────────────────────────────────────────────

const classesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      locationId: z.number().optional(),
      upcoming: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      // Instructors only see assigned classes
      if (ctx.user.role === "instructor") {
        const all = await listClasses(input ?? {});
        // For now return all — class_staff filtering can be added later
        return all;
      }
      return listClasses(input ?? {});
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
      status: z.enum(["upcoming", "in_progress", "completed", "cancelled"]).optional(),
      price: z.string().optional(),
      wooProductId: z.string().optional(),
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
      await updateClass(input.id, { isActive: false } as any);
      await logActivity({
        actorUserId: ctx.user.id,
        actionType: "class_updated",
        entityType: "class",
        entityId: input.id,
        notes: "Class archived",
      });
      return { success: true };
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
});

// ─── Students Router ──────────────────────────────────────────────────────────

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
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

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
});

export type AppRouter = typeof appRouter;
