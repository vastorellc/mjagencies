CREATE TABLE "admin_provider_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"error_message" text,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "available_niches" text[] DEFAULT ARRAY['travel','hotels','cars','bikes','coding','lifestyle','food','other']::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_provider_health_provider_model_idx" ON "admin_provider_health" USING btree ("provider","model_id","checked_at");--> statement-breakpoint
CREATE INDEX "admin_provider_health_checked_at_idx" ON "admin_provider_health" USING btree ("checked_at");