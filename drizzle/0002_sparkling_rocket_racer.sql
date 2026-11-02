ALTER TABLE "annotations" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "arrangement_entries" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bands" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tunings" ADD COLUMN "field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL;