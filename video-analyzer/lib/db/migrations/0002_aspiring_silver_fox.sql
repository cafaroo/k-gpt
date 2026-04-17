ALTER TABLE "Analysis" ADD COLUMN "peopleCountMax" integer;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "eyeContactScore" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "scriptAngle" text;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "primaryGender" text;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "socioeconomic" text;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "audienceProfile" jsonb;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "peopleAnalysis" jsonb;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "cutsMap" jsonb;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "scriptMeta" jsonb;--> statement-breakpoint
ALTER TABLE "Analysis" ADD COLUMN "eyeContact" jsonb;