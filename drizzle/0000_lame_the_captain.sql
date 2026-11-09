CREATE TABLE "day_limits" (
	"weekday" smallint PRIMARY KEY NOT NULL,
	"max_remote" smallint NOT NULL,
	CONSTRAINT "day_limits_weekday_range" CHECK ("day_limits"."weekday" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"has_parking_card" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reminders_sent" (
	"week_start" date PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remote_days_person_date" UNIQUE("person_id","date")
);
--> statement-breakpoint
ALTER TABLE "remote_days" ADD CONSTRAINT "remote_days_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remote_days_date_idx" ON "remote_days" USING btree ("date");