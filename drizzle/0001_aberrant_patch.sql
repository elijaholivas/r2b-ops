CREATE TABLE `activityLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`actionType` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`oldValues` json,
	`newValues` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adminAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classStaff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`userId` int NOT NULL,
	`roleOnClass` varchar(50) DEFAULT 'instructor',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classStaff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`classType` varchar(100),
	`description` text,
	`locationId` int,
	`instructorId` int,
	`startDatetime` timestamp NOT NULL,
	`endDatetime` timestamp NOT NULL,
	`capacity` int NOT NULL DEFAULT 20,
	`status` enum('upcoming','in_progress','completed','cancelled') NOT NULL DEFAULT 'upcoming',
	`wooProductId` varchar(64),
	`wooVariationId` varchar(64),
	`price` varchar(20),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollmentId` int,
	`classId` int,
	`studentId` int,
	`toEmail` varchar(320) NOT NULL,
	`toName` varchar(255),
	`templateKey` varchar(100) NOT NULL,
	`subject` varchar(255),
	`bodyHtml` text,
	`scheduledFor` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailQueue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateKey` varchar(100) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`bodyHtml` text NOT NULL,
	`bodyText` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `emailTemplates_templateKey_unique` UNIQUE(`templateKey`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`studentId` int NOT NULL,
	`status` enum('enrolled','moved','removed','cancelled','attended','no_show') NOT NULL DEFAULT 'enrolled',
	`paymentStatus` enum('paid','unpaid','free') NOT NULL DEFAULT 'unpaid',
	`source` enum('woocommerce','manual','import') NOT NULL DEFAULT 'manual',
	`wooOrderId` varchar(64),
	`wooOrderItemId` varchar(64),
	`confirmationSentAt` timestamp,
	`reminderSentAt` timestamp,
	`checkedInAt` timestamp,
	`removedAt` timestamp,
	`movedFromClassId` int,
	`movedToClassId` int,
	`internalNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wooBaseUrl` varchar(255),
	`wooConsumerKey` varchar(255),
	`wooConsumerSecret` varchar(255),
	`webhookSecret` varchar(255),
	`mailgunApiKey` varchar(255),
	`mailgunDomain` varchar(255) DEFAULT 'mail.r2bear.com',
	`defaultFromEmail` varchar(320) DEFAULT 'info@mail.r2bear.com',
	`defaultReplyTo` varchar(320) DEFAULT 'info@r2bear.com',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrationSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address1` varchar(255),
	`address2` varchar(255),
	`city` varchar(100),
	`state` varchar(50),
	`zip` varchar(20),
	`timezone` varchar(64) NOT NULL DEFAULT 'America/Los_Angeles',
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(30),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','admin','staff','instructor','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;