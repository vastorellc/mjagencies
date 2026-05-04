CREATE TABLE "content_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idea" jsonb NOT NULL,
	"niches" text[] DEFAULT '{}' NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"saved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trend_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"niche" text NOT NULL,
	"data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trend_cache_source_niche_unique" UNIQUE("source","niche")
);
--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_ideas_user_generated_idx" ON "content_ideas" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE POLICY "content_ideas_user_own" ON "content_ideas" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);