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
