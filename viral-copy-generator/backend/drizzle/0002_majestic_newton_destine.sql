CREATE TABLE "platform_viral_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"niche" text NOT NULL,
	"related_niches" text[] DEFAULT '{}' NOT NULL,
	"view_tier" text NOT NULL,
	"pattern_data" jsonb NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_viral_patterns_unique" UNIQUE("platform","niche","view_tier")
);
--> statement-breakpoint
CREATE TABLE "video_ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_pattern_analysis_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"ai_recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_score" integer NOT NULL,
	"analysis_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_ai_insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"niche" text NOT NULL,
	"engine_signals" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_pattern_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_analysis_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"matched_pattern_id" uuid NOT NULL,
	"similarity_score" integer NOT NULL,
	"matched_view_tier" text NOT NULL,
	"gaps_detected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_pattern_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_ai_insights" ADD CONSTRAINT "video_ai_insights_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_ai_insights" ADD CONSTRAINT "video_ai_insights_pattern_analysis_fk" FOREIGN KEY ("video_pattern_analysis_id") REFERENCES "public"."video_pattern_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analysis" ADD CONSTRAINT "video_analysis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analysis" ADD CONSTRAINT "video_analysis_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pattern_analysis" ADD CONSTRAINT "video_pattern_analysis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pattern_analysis" ADD CONSTRAINT "video_pattern_analysis_video_analysis_fk" FOREIGN KEY ("video_analysis_id") REFERENCES "public"."video_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pattern_analysis" ADD CONSTRAINT "video_pattern_analysis_pattern_fk" FOREIGN KEY ("matched_pattern_id") REFERENCES "public"."platform_viral_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_viral_patterns_platform_niche_idx" ON "platform_viral_patterns" USING btree ("platform","niche");--> statement-breakpoint
CREATE INDEX "video_ai_insights_video_pattern_idx" ON "video_ai_insights" USING btree ("video_pattern_analysis_id");--> statement-breakpoint
CREATE INDEX "video_analysis_post_idx" ON "video_analysis" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "video_analysis_niche_created_idx" ON "video_analysis" USING btree ("niche","created_at");--> statement-breakpoint
CREATE INDEX "video_pattern_analysis_video_idx" ON "video_pattern_analysis" USING btree ("video_analysis_id");--> statement-breakpoint
CREATE INDEX "video_pattern_analysis_platform_idx" ON "video_pattern_analysis" USING btree ("platform");--> statement-breakpoint
CREATE POLICY "video_ai_insights_user_own" ON "video_ai_insights" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "video_analysis_user_own" ON "video_analysis" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "video_pattern_analysis_user_own" ON "video_pattern_analysis" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);