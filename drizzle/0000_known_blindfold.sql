CREATE TABLE `calendar_cache` (
	`user_id` text PRIMARY KEY NOT NULL,
	`events` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`feed_url` text NOT NULL,
	`updated_at` integer NOT NULL
);
