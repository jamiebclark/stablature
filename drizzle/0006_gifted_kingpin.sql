CREATE TABLE "memo_audio" (
	"memo_id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text,
	"bytes" "bytea",
	"uploaded_at" timestamp with time zone,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"recorded_by_id" text,
	"recorded_by_name" text,
	"duration_ms" integer NOT NULL,
	"format" text NOT NULL,
	"size" integer NOT NULL,
	"recorded_at" bigint NOT NULL,
	"label" text,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"server_seq" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memo_audio" ADD CONSTRAINT "memo_audio_memo_id_memos_id_fk" FOREIGN KEY ("memo_id") REFERENCES "public"."memos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memo_audio" ADD CONSTRAINT "memo_audio_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memo_audio_band_idx" ON "memo_audio" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "memos_part_idx" ON "memos" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "memos_band_idx" ON "memos" USING btree ("band_id");--> statement-breakpoint
CREATE INDEX "memos_seq_idx" ON "memos" USING btree ("server_seq");