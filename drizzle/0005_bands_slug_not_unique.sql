DROP INDEX "bands_slug_idx";--> statement-breakpoint
CREATE INDEX "bands_slug_idx" ON "bands" USING btree ("slug");