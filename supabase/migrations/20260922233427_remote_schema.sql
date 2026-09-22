CREATE TABLE "public"."analyses" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_id"        uuid                     NOT NULL,
  "file_name"          text,
  "total_leakage"      numeric                  NOT NULL DEFAULT 0,
  "estimated_recovery" numeric                  NOT NULL DEFAULT 0,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "analyses_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."analyses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."businesses" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id"    uuid,
  CONSTRAINT "businesses_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."businesses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."leaks" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "analysis_id"       uuid                     NOT NULL,
  "customer"          text                     NOT NULL,
  "type"              text                     NOT NULL,
  "amount"            numeric                  NOT NULL DEFAULT 0,
  "recovery"          numeric                  NOT NULL DEFAULT 0,
  "severity"          text                     NOT NULL,
  "reason"            text                     NOT NULL,
  "action"            text                     NOT NULL,
  "date"              date,
  "days_open"         integer,
  "status"            text                     NOT NULL DEFAULT 'Open'::text,
  "priority_score"    numeric,
  "priority_level"    text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "category"          text                     DEFAULT 'Recoverable'::text,
  "notes"             text,
  "follow_up_date"    date,
  "contact_attempts"  integer                  NOT NULL DEFAULT 0,
  "last_contacted_at" timestamp with time zone,
  "recovered_amount"  numeric                  NOT NULL DEFAULT 0,
  "recovered_at"      timestamp with time zone,
  CONSTRAINT "leaks_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."leaks"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."analyses"
  ADD CONSTRAINT "analyses_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE "public"."leaks"
  ADD CONSTRAINT "leaks_analysis_id_fkey" FOREIGN KEY (analysis_id) REFERENCES public.analyses(id) ON DELETE CASCADE;

CREATE POLICY "Users can access their own analyses" ON "public"."analyses"
  FOR ALL
  TO "authenticated"
  USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.user_id = auth.uid()))))
  WITH CHECK ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.user_id = auth.uid()))));

CREATE POLICY "Users can access their own business" ON "public"."businesses"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can access their own leaks" ON "public"."leaks"
  FOR ALL
  TO "authenticated"
  USING ((analysis_id IN ( SELECT analyses.id
   FROM public.analyses
  WHERE (analyses.business_id IN ( SELECT businesses.id
           FROM public.businesses
          WHERE (businesses.user_id = auth.uid()))))))
  WITH CHECK ((analysis_id IN ( SELECT analyses.id
   FROM public.analyses
  WHERE (analyses.business_id IN ( SELECT businesses.id
           FROM public.businesses
          WHERE (businesses.user_id = auth.uid()))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analyses" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."businesses" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."leaks" TO "anon", "authenticated", "postgres", "service_role";

