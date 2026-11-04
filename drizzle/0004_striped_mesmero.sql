CREATE TYPE "public"."group_kind" AS ENUM('tuplet', 'plain');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "group_kind" "group_kind";