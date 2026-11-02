CREATE TABLE "band_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"band_id" uuid NOT NULL,
	"code" text NOT NULL,
	"role" "band_role" DEFAULT 'editor' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "band_invites" ADD CONSTRAINT "band_invites_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_invites" ADD CONSTRAINT "band_invites_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "band_invites_code_idx" ON "band_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "band_invites_band_idx" ON "band_invites" USING btree ("band_id");