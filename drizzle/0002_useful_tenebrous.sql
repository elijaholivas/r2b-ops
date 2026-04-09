CREATE TABLE `ccwRenewalReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`classId` int NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','cancelled') NOT NULL DEFAULT 'pending',
	`emailQueueId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ccwRenewalReminders_id` PRIMARY KEY(`id`)
);
