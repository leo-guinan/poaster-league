CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`intent` text,
	`relationships` text,
	`post_to_twitter` integer DEFAULT false,
	`post_to_pro_feed` integer DEFAULT true,
	`quality_checks` text,
	`draft_maturity` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`intent` text,
	`relationships` text,
	`post_to_twitter` integer DEFAULT false,
	`post_to_pro_feed` integer DEFAULT true,
	`twitter_post_id` text,
	`quality_checks` text,
	`draft_maturity` integer DEFAULT 0,
	`status` text DEFAULT 'draft',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer
);
