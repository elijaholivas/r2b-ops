import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock database helpers ────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    getClassById: vi.fn(),
    getEnrollmentsForClass: vi.fn(),
    findActiveEnrollment: vi.fn(),
    findStudentByEmail: vi.fn(),
    createStudent: vi.fn(),
    createEnrollment: vi.fn(),
    searchStudents: vi.fn(),
    listClasses: vi.fn(),
    getAdminAlerts: vi.fn(),
    getEmailQueueForAdmin: vi.fn(),
    getRecentActivity: vi.fn(),
    logActivity: vi.fn(),
    queueEmail: vi.fn(),
    getEmailTemplate: vi.fn(),
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
  };
});

// ─── Context helpers ──────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<NonNullable<TrpcContext["user"]>> = {}): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user",
    email: "test@r2bear.com",
    name: "Test User",
    loginMethod: "local",
    role: "super_admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function makeGuestCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeGuestCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the current user when authenticated", async () => {
    const ctx = makeCtx({ email: "admin@r2bear.com", name: "Admin User" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("admin@r2bear.com");
    expect(result?.name).toBe("Admin User");
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

// ─── Classes tests ────────────────────────────────────────────────────────────

describe("classes.list", () => {
  it("returns upcoming classes for authenticated users", async () => {
    const { listClasses } = await import("./db");
    vi.mocked(listClasses).mockResolvedValue([
      {
        id: 1,
        title: "Initial CCW Certification",
        startDatetime: new Date("2026-04-19T08:00:00"),
        endDatetime: new Date("2026-04-20T17:00:00"),
        capacity: 20,
        enrolledCount: 5,
        status: "upcoming",
        locationId: 1,
        classType: "CCW Certification Class",
        description: null,
        isActive: true,
        price: "149.00",
        wooProductId: "101",
        wooVariationId: null,
        instructorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.classes.list({ upcoming: true });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Initial CCW Certification");
  });
});

describe("classes.get", () => {
  it("throws NOT_FOUND when class does not exist", async () => {
    const { getClassById } = await import("./db");
    vi.mocked(getClassById).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.classes.get({ id: 9999 })).rejects.toThrow();
  });

  it("returns class data when class exists", async () => {
    const { getClassById, getEnrollmentsForClass } = await import("./db");
    vi.mocked(getClassById).mockResolvedValue({
      id: 1,
      title: "Initial CCW Certification",
      startDatetime: new Date("2026-04-19T08:00:00"),
      endDatetime: new Date("2026-04-20T17:00:00"),
      capacity: 20,
      enrolledCount: 5,
      status: "upcoming",
      locationId: 1,
      classType: "CCW Certification Class",
      description: null,
      isActive: true,
      price: "149.00",
      wooProductId: "101",
      wooVariationId: null,
      instructorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(getEnrollmentsForClass).mockResolvedValue([]);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.classes.get({ id: 1 });
    expect(result.title).toBe("Initial CCW Certification");
    expect(result.capacity).toBe(20);
  });
});

// ─── Enrollment tests ─────────────────────────────────────────────────────────

describe("enrollments.add", () => {
  it("throws FORBIDDEN for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeGuestCtx());
    await expect(
      caller.enrollments.add({
        classId: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        paymentStatus: "unpaid",
        sendConfirmation: false,
        overrideDuplicate: false,
      })
    ).rejects.toThrow();
  });

  it("detects duplicate enrollment and returns duplicate flag", async () => {
    const { getClassById, findActiveEnrollment, findStudentByEmail } = await import("./db");

    vi.mocked(getClassById).mockResolvedValue({
      id: 1,
      title: "Initial CCW",
      capacity: 20,
      enrolledCount: 5,
      status: "upcoming",
    } as any);

    vi.mocked(findStudentByEmail).mockResolvedValue({
      id: 42,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(findActiveEnrollment).mockResolvedValue({
      id: 99,
      classId: 1,
      studentId: 42,
      status: "enrolled",
      paymentStatus: "unpaid",
      source: "manual",
      wooOrderId: null,
      wooOrderItemId: null,
      attendanceStatus: "registered",
      notes: null,
      internalNotes: null,
      enrolledAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const caller = appRouter.createCaller(makeCtx());
    // The router throws CONFLICT when a duplicate is detected
    await expect(
      caller.enrollments.add({
        classId: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        paymentStatus: "unpaid",
        sendConfirmation: false,
        overrideDuplicate: false,
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "DUPLICATE_ENROLLMENT" });
  });
});

// ─── Student search tests ─────────────────────────────────────────────────────

describe("students.search", () => {
  it("returns matching students for a query", async () => {
    const { searchStudents } = await import("./db");
    vi.mocked(searchStudents).mockResolvedValue([
      {
        id: 1,
        firstName: "Maria",
        lastName: "Garcia",
        email: "maria.garcia@email.com",
        phone: "951-555-0101",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        enrollments: [],
      } as any,
    ]);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.students.search({ query: "maria" });
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe("Maria");
  });

  it("returns empty array for no matches", async () => {
    const { searchStudents } = await import("./db");
    vi.mocked(searchStudents).mockResolvedValue([]);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.students.search({ query: "zzznomatch" });
    expect(result).toHaveLength(0);
  });
});

// ─── Admin access control tests ───────────────────────────────────────────────

describe("admin.alerts", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" as any }));
    await expect(caller.admin.alerts({ unreadOnly: false })).rejects.toThrow();
  });

  it("returns alerts for admin users", async () => {
    const { getAdminAlerts } = await import("./db");
    vi.mocked(getAdminAlerts).mockResolvedValue([]);

    const caller = appRouter.createCaller(makeCtx({ role: "admin" as any }));
    const result = await caller.admin.alerts({ unreadOnly: false });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.emailQueue", () => {
  it("returns email queue for admin users", async () => {
    const { getEmailQueueForAdmin } = await import("./db");
    vi.mocked(getEmailQueueForAdmin).mockResolvedValue([]);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.admin.emailQueue();
    expect(Array.isArray(result)).toBe(true);
  });
});
