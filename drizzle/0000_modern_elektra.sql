CREATE TYPE "public"."annotation_kind" AS ENUM('chord', 'text', 'dynamic');--> statement-breakpoint
CREATE TYPE "public"."arrangement_entry_kind" AS ENUM('part', 'section_start', 'section_end', 'text');--> statement-breakpoint
CREATE TYPE "public"."band_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."duration_hint" AS ENUM('w', 'h', 'q', '8', '16', '32');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('notes', 'barline', 'rest');--> statement-breakpoint
CREATE SEQUENCE "public"."global_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"anchor_event_id" uuid,
	"kind" "annotation_kind" DEFAULT 'chord' NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrangement_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"rank" text NOT NULL,
	"kind" "arrangement_entry_kind" DEFAULT 'part' NOT NULL,
	"part_id" uuid,
	"repeat" integer DEFAULT 1 NOT NULL,
	"from_bar" integer,
	"to_bar" integer,
	"last_repeat_part_id" uuid,
	"label" text,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "band_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "band_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"rank" text NOT NULL,
	"kind" "event_kind" DEFAULT 'notes' NOT NULL,
	"frets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"techniques" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"repeat" integer DEFAULT 1 NOT NULL,
	"duration_hint" "duration_hint",
	"tuplet_id" uuid,
	"tuplet_count" integer,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"label" text NOT NULL,
	"name" text,
	"rank" text NOT NULL,
	"variant_of_part_id" uuid,
	"notes" text,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"title" text NOT NULL,
	"tuning_id" uuid,
	"bpm" integer,
	"notes" text,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tunings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"name" text NOT NULL,
	"strings" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_anchor_event_id_events_id_fk" FOREIGN KEY ("anchor_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_entries" ADD CONSTRAINT "arrangement_entries_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_entries" ADD CONSTRAINT "arrangement_entries_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_entries" ADD CONSTRAINT "arrangement_entries_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_entries" ADD CONSTRAINT "arrangement_entries_last_repeat_part_id_parts_id_fk" FOREIGN KEY ("last_repeat_part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_members" ADD CONSTRAINT "band_members_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_members" ADD CONSTRAINT "band_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_variant_of_part_id_parts_id_fk" FOREIGN KEY ("variant_of_part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_tuning_id_tunings_id_fk" FOREIGN KEY ("tuning_id") REFERENCES "public"."tunings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tunings" ADD CONSTRAINT "tunings_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annotations_part_idx" ON "annotations" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "annotations_band_idx" ON "annotations" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "annotations_seq_idx" ON "annotations" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "arrangement_song_idx" ON "arrangement_entries" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "arrangement_band_idx" ON "arrangement_entries" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "arrangement_seq_idx" ON "arrangement_entries" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "band_members_unique_idx" ON "band_members" USING btree ("band_id","user_id");--> statement-breakpoint
CREATE INDEX "band_members_user_idx" ON "band_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bands_slug_idx" ON "bands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "bands_seq_idx" ON "bands" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "events_part_idx" ON "events" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "events_band_idx" ON "events" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "events_seq_idx" ON "events" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "parts_song_idx" ON "parts" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "parts_band_idx" ON "parts" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "parts_seq_idx" ON "parts" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "songs_band_idx" ON "songs" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "songs_seq_idx" ON "songs" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "tunings_band_idx" ON "tunings" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "tunings_seq_idx" ON "tunings" USING btree ("server_seq");