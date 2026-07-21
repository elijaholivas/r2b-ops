# R2B Class Operations — TODO

## Schema & Infrastructure
- [x] Full database schema (locations, classes, students, enrollments, activity_log, email_queue, integration_settings, class_staff, admin_alerts, email_templates)
- [x] Database migrations applied
- [x] Role enum extended: super_admin, admin, staff, instructor
- [x] Seed demo data (classes, students, enrollments)

## Authentication
- [x] Email + password login (local auth via bcrypt)
- [x] Role-based access: super_admin, admin, staff, instructor
- [x] Protected routes per role
- [x] R2B branded login screen (dark charcoal, red accents, white text)

## Class Management
- [x] Class list dashboard (mobile card view)
- [x] Class cards: title, date, location, seat count, capacity progress bar, status
- [x] Class detail screen with full roster
- [x] Class create form (super_admin/admin)
- [x] Class duplicate action
- [x] Class archive action
- [x] Filter classes: upcoming, past, location, instructor, full/not full

## Roster & Enrollment
- [x] Roster table per class: name, email, payment status pill, source, attendance
- [x] Payment status pills: Paid=green, Unpaid=amber, Free=blue
- [x] Seat count and capacity progress bar on class detail

## Add Student Flow
- [x] Add student modal: first name, last name, email, phone, payment status
- [x] Duplicate enrollment detection with admin override prompt
- [x] Seat count update on add
- [x] Optional confirmation email trigger on add

## Remove Student Flow
- [x] Remove student from class with confirmation
- [x] Seat count update on remove
- [x] Activity log entry on remove

## Move Student Flow (Atomic)
- [x] Move student modal: current class, destination class dropdown, seat availability check
- [x] Atomic transaction: remove from old, add to new, update both counts, log activity
- [x] Block move if destination is full
- [x] Optional notify student toggle on move

## WooCommerce Integration
- [x] WooCommerce webhook endpoint (POST /api/webhooks/woocommerce)
- [x] Webhook signature validation
- [x] Order → enrollment mapping (create student if not found, create enrollment)
- [x] Unmapped product admin alert in dashboard
- [x] integration_settings table for Woo credentials

## Email System (Mailgun)
- [x] Mailgun integration helper (server/email.ts, sender: info@mail.r2bear.com)
- [x] Confirmation email queued on enrollment
- [x] 2-day reminder email scheduling logic
- [x] Email queue with retry tracking
- [x] Email failures visible in admin dashboard
- [x] Email templates: confirmation, reminder
- [x] Live email sending (requires MAILGUN_API_KEY — enter in Admin → Settings tab)

## CSV Export
- [x] Per-class CSV export: first name, last name, email, phone, class title, date, location, payment status, attendance status

## Student Search
- [x] Search across all enrollments by name, email, phone
- [x] Student detail view: current and past class history

## Admin Dashboard
- [x] Upcoming classes overview with stats
- [x] Seats remaining stats
- [x] Unmapped WooCommerce product alerts
- [x] Email queue failure alerts with retry button
- [x] Recent activity log

## PWA
- [x] Web app manifest (name, icons, theme_color, background_color)
- [x] Service worker for offline shell caching
- [x] Responsive mobile-first layout throughout
- [x] PWA meta tags for iOS and Android install

## Testing
- [x] Vitest: auth.me (guest + authenticated)
- [x] Vitest: auth.logout (cookie cleared)
- [x] Vitest: classes.list (returns upcoming)
- [x] Vitest: classes.get (NOT_FOUND + returns data)
- [x] Vitest: enrollments.add (FORBIDDEN for guest, CONFLICT on duplicate)
- [x] Vitest: students.search (matches + empty)
- [x] Vitest: admin.alerts (FORBIDDEN for non-admin, returns for admin)
- [x] Vitest: admin.emailQueue (returns queue)

## Settings Page (in-app credential management)
- [x] Settings tab in Admin panel: Mailgun API key, domain, sender name fields
- [x] Settings tab: WooCommerce site URL, consumer key, consumer secret, webhook secret fields
- [x] Save/update settings via tRPC mutation (stored in integrationSettings table)
- [x] Wire email sender to read Mailgun key from DB settings (fall back to env var)
- [x] Wire webhook validator to read WOO_WEBHOOK_SECRET from DB settings
- [x] Test connection buttons for Mailgun and WooCommerce in Settings tab

## Pending (requires external credentials)
- [x] MAILGUN_API_KEY — enter in Admin → Settings tab (in-app, no env var needed)
- [x] WOO_CONSUMER_KEY + WOO_CONSUMER_SECRET — enter in Admin → Settings tab
- [x] WOO_SITE_URL — enter in Admin → Settings tab
- [x] WOO_WEBHOOK_SECRET — enter in Admin → Settings tab

## User Management (Admin Panel)
- [x] List all users in Admin panel with name, email, role, last sign-in
- [x] Create user form: first name, last name, email, password, role selector
- [x] Edit user: change role, reset password
- [x] Deactivate/reactivate user account
- [x] Server: createUser mutation with bcrypt password hashing
- [x] Server: updateUser mutation (role, password reset)
- [x] Server: deactivateUser mutation

## Bugs
- [x] Login redirect loop: fixed — JWT payload format corrected + service worker cache bug resolved

## V1.17 Features
- [x] Auto-update class status based on current date (past classes show 'Past' not 'Upcoming')
- [x] Classes screen: split into two sections — Upcoming (top) and Past (bottom)
- [x] Sort: upcoming classes ascending by date, past classes descending by date

## V1.16 Features
- [x] Auto-archive scheduler: mark classes as archived 8 hours after end time
- [x] Dashboard and class list: exclude archived classes from default view
- [x] Archive tab: view all archived classes with full roster access
- [x] Admin restore action: un-archive a class back to active

## V1.15 Features
- [x] Download and parse class/student data files from Google Drive
- [x] Import real classes and students into the database (additive, no deletions)
- [x] Confirmed WooCommerce sync never deletes existing classes or students (additive only)

## V1.12 Features
- [x] Update syncWooProducts to parse class_date, class_location, stock qty meta and auto-create classes
- [x] Skip products already mapped (wooProductId exists in classes table)
- [x] Show sync results in UI (created vs skipped counts)

## V1.11 Features
- [x] Clear all dummy/test classes and related data from the database
- [x] Build Sync Products button in Admin → WooCommerce Mapping tab
- [x] Fetch WooCommerce products via REST API and display for mapping

## Bugs (V1.8)
- [x] Fix WooCommerce webhook endpoint returning HTTP 500 on delivery test

## New Features (V1.6)

### R2B Logo Branding
- [x] Upload R2B logo as static asset (/manus-storage/r2b-logo_db30176c.png)
- [x] Login page: R2B logo replaces Shield icon placeholder
- [x] AppLayout sidebar: R2B logo in sidebar header and mobile top bar
- [x] Fix EmailScheduler 'Failed query' error in 2-day reminder scheduling (Drizzle LIMIT issue)
- [x] Add Change My Password screen for logged-in users
- [x] Add configurable CCW renewal product URL in Admin → Settings tab

## New Features (V1.5)

### Edit Student Profile
- [x] Edit student modal: update name, email, phone fields
- [x] Server: students.update mutation (name, email, phone)
- [x] Show edit button on ClassDetail roster row (three-dot menu)

### Class Check-In
- [x] Check-in toggle per enrollment on ClassDetail roster (tap to mark present/absent)
- [x] Bulk check-in: "Check In All" button for quick full-class attendance
- [x] Check-in timestamp stored on enrollment record
- [x] Check-in summary shown on ClassDetail (X of Y checked in)
- [x] Server: enrollments.checkIn mutation (toggle attended status + timestamp)
- [x] Server: enrollments.bulkCheckIn mutation

### Manual Confirmation / Reminder Emails
- [x] "Send Confirmation" button per enrollment on ClassDetail roster (three-dot menu)
- [x] "Send Reminder" button per enrollment on ClassDetail roster (three-dot menu)
- [x] "Send Reminder to All" bulk action on ClassDetail
- [x] Server: enrollments.sendConfirmationEmail and enrollments.sendReminderEmail mutations
- [x] Server: enrollments.sendBulkReminders mutation
- [x] Toast feedback on send success/failure

### CCW Renewal Reminder (18-month auto-email)
- [x] DB: ccwRenewalReminders table (enrollmentId, scheduledAt, sentAt, status)
- [x] On enrollment in any CCW Initial class, schedule a reminder for 18 months out
- [x] Scheduler checks for due CCW reminders every 15 minutes and sends email
- [x] Email includes student name, original class date, link to purchase renewal
- [x] Admin panel: CCW Renewals tab showing upcoming and sent reminders with stats
- [x] Server: ccwRenewals.list, sendNow, processNow, cancel, stats procedures

## V1.18 Features
- [x] Fix class time display — classes were showing 1-2 AM due to UTC→local timezone conversion
- [x] Created dateUtils.ts with parseClassDatetime() that re-interprets UTC wall-clock values as the intended local time
- [x] Updated all date display: Classes, ClassDetail, Dashboard, Archive, MoveStudentModal, StudentDetail, CCWRenewalsTab
- [x] 10 new Vitest tests for dateUtils (26 total, all passing)

## V1.19 Features
- [x] Edit capacity inline on Class Detail — admins see a pencil icon next to the seat count; tap to enter a new number, Save/Cancel, Enter/Escape keyboard shortcuts
- [x] classes.updateCapacity tRPC mutation — validates 1–500, logs old/new values to activity log

## V1.20 Features
- [x] WooCommerce auto-sync handler at /api/scheduled/woo-sync (Heartbeat cron endpoint)
- [x] SDK patches: AuthenticatedUser type, CRON_OPEN_ID_PREFIX, buildCronUser — cron identity support in authenticateRequest
- [x] manusTypes.ts: added taskUid field to GetUserInfoWithJwtResponse
- [x] Extracted runWooSync() into server/wooSync.ts — shared by manual tRPC mutation and scheduled handler
- [x] Handler sends owner notification when new classes are created
- [x] Handler returns 200 (not 500) when WooCommerce credentials are not yet configured — prevents unnecessary retries
- [x] Register 6-hour Heartbeat cron — active, fires at 00:00/06:00/12:00/18:00 UTC, taskUid: zBFTZucCmDCpJM4e1l2zoD

## V1.21 Features
- [x] Remove 20-seat hard cap: allow capacity to be set to any positive number in the inline editor on Class Detail
- [x] Fix enrollment guard: if enrolled count already exceeds capacity (Wix imports), allow adding students up to the new capacity
- [x] Update updateCapacity server validation to accept any positive integer (remove max:20 if present)

## V1.22 Features
- [x] ccwRenewalReminders table confirmed in DB (scheduledFor, status, enrollmentId, studentId, classId)
- [x] checkIn procedure: when attended=true and class title/type matches Initial or Re-Cert, calls scheduleCcwRenewal() to insert a pending reminder 18 months after class date
- [x] bulkCheckIn procedure: same logic applied to all checked-in students in the class
- [x] scheduleRenewalReminders() added to emailScheduler.ts: queries getDueCcwRenewals(), queues branded HTML email with booking CTA, marks reminder as sent
- [x] scheduleRenewalReminders() wired into the 15-min cron in server/_core/index.ts
- [x] 26/26 tests passing, 0 TypeScript errors

## V1.23 Features
- [x] Admin Settings: CCW Renewal Product URL field already built in SettingsTab — shows current URL, allows update, saves to integrationSettings.ccwRenewalProductUrl
- [x] CCW Renewals tab in Admin: fully built (CCWRenewalsTab.tsx) with stats row (total/pending/sent/due this month), per-reminder rows with student name, email, class date, scheduled send date, status badge, Send Now and Cancel actions, Process Now button

## V1.24 Features
- [x] vite-plugin-pwa not needed — manifest and service worker already hand-crafted (sw.js v3)
- [x] Generated PWA icons: icon-192.png, icon-512.png, apple-touch-icon.png (180x180) — dark bg + R2B red circle + bold white text
- [x] manifest.json updated: scope, apple-touch-icon entry, separate any/maskable purpose entries
- [x] index.html updated: apple-touch-icon link, icon-192/512 link tags
- [x] PWAInstallPrompt.tsx component: shows Android Chrome install banner, dismissed permanently via localStorage
- [x] PWAInstallPrompt wired into App.tsx

## V1.25 Features
- [x] Backend: trpc.enrollments.recent query — returns enrollments created after a given timestamp with student name + class title
- [x] Frontend: useEnrollmentChime hook — polls every 30s, plays Web Audio API chime (E5 + G#5 two-note ding) + shows sonner toast with student name and class title
- [x] No external audio file — chime synthesized in-browser using Web Audio API oscillators
- [x] EnrollmentChimeProvider wired into App.tsx — runs on all pages when logged in, silent fail if audio blocked

## V1.26 Features
- [x] VAPID keys generated and stored as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets
- [x] pushSubscriptions table added to schema and migrated to live DB (endpoint, p256dh, auth, userId, userAgent)
- [x] tRPC push router: getPublicKey, subscribe, unsubscribe
- [x] server/pushNotifications.ts: saveSubscription, removeSubscription, sendPushToAllAdmins (auto-removes stale 410 subs)
- [x] sw.js updated: push event handler shows notification with icon/badge/vibrate/actions; notificationclick opens class page
- [x] sendPushToAllAdmins wired into enrollments.add mutation (non-blocking, silent fail)
- [x] usePushNotifications hook: permission request, subscribe/unsubscribe, stale sub cleanup
- [x] PushNotificationToggle component: bell icon in mobile top bar (green BellRing when subscribed)
- [x] 26/26 tests passing, 0 TypeScript errors

## V1.27 Features
- [x] Update email From address from info@mail.r2bear.com to reminder@r2bear.com
- [x] Update default Mailgun sending domain from mail.r2bear.com to r2bear.com
- [x] MAILGUN_API_KEY stored as environment secret (cdbb32fe... key)
- [x] DB integrationSettings updated: mailgunDomain=r2bear.com, defaultFromEmail=reminder@r2bear.com
- [x] SettingsTab UI updated: placeholder domain shows r2bear.com, sender address shows reminder@r2bear.com
- [x] email.ts: respects defaultFromEmail from DB settings (falls back to reminder@r2bear.com)
- [x] 26/26 tests passing, 0 TypeScript errors
