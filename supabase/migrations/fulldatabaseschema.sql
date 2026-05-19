-- TrendScope Studio — full database schema (single source of truth)
-- Run in Supabase SQL Editor as one script (PostgreSQL 15+)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helper: updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_settings (must exist before auth signup trigger)
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  dashboard_default_category text NOT NULL DEFAULT 'all',
  dashboard_default_date_range text NOT NULL DEFAULT '30d',
  watchlist_default_interval text NOT NULL DEFAULT 'daily' CHECK (watchlist_default_interval IN ('hourly', 'daily', 'weekly', 'monthly')),
  notifications_trend_alerts boolean NOT NULL DEFAULT true,
  export_default_format text NOT NULL DEFAULT 'pdf' CHECK (export_default_format IN ('pdf', 'csv', 'json')),
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  data_source_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- source_platforms
-- -----------------------------------------------------------------------------
CREATE TABLE public.source_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  rss_feed_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- topics (global)
-- -----------------------------------------------------------------------------
CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topics_name_unique UNIQUE (name)
);

CREATE INDEX idx_topics_slug ON public.topics (slug);

-- -----------------------------------------------------------------------------
-- documents (global, de-duplicated by URL)
-- -----------------------------------------------------------------------------
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text NOT NULL,
  summary text,
  content_preview text,
  source_platform_id uuid REFERENCES public.source_platforms (id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_url_unique UNIQUE (url)
);

CREATE INDEX idx_documents_source ON public.documents (source_platform_id);
CREATE INDEX idx_documents_published_at ON public.documents (published_at DESC);

CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- document_topics
-- -----------------------------------------------------------------------------
CREATE TABLE public.document_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
  relevance_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_topics_document_topic_unique UNIQUE (document_id, topic_id)
);

CREATE INDEX idx_document_topics_topic ON public.document_topics (topic_id);
CREATE INDEX idx_document_topics_document ON public.document_topics (document_id);

-- -----------------------------------------------------------------------------
-- document_sentiments
-- -----------------------------------------------------------------------------
CREATE TABLE public.document_sentiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('positive', 'neutral', 'negative')),
  score numeric NOT NULL,
  model_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_sentiments_document_unique UNIQUE (document_id)
);

-- -----------------------------------------------------------------------------
-- trend_snapshots (time series per topic)
-- -----------------------------------------------------------------------------
CREATE TABLE public.trend_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  mention_count integer NOT NULL DEFAULT 0,
  positive_count integer NOT NULL DEFAULT 0,
  neutral_count integer NOT NULL DEFAULT 0,
  negative_count integer NOT NULL DEFAULT 0,
  avg_sentiment_score numeric,
  growth_metric numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trend_snapshots_topic_date_unique UNIQUE (topic_id, snapshot_date)
);

CREATE INDEX idx_trend_snapshots_topic_date ON public.trend_snapshots (topic_id, snapshot_date DESC);

-- -----------------------------------------------------------------------------
-- search_runs (user-owned)
-- -----------------------------------------------------------------------------
CREATE TABLE public.search_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE RESTRICT,
  query_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_search_runs_user_created ON public.search_runs (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- related_topics (scoped to a search run)
-- -----------------------------------------------------------------------------
CREATE TABLE public.related_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_run_id uuid NOT NULL REFERENCES public.search_runs (id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
  related_topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
  similarity_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_related_topics_run ON public.related_topics (search_run_id);

-- -----------------------------------------------------------------------------
-- topic_clusters (scoped to a search run)
-- -----------------------------------------------------------------------------
CREATE TABLE public.topic_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_run_id uuid NOT NULL REFERENCES public.search_runs (id) ON DELETE CASCADE,
  label text NOT NULL,
  cluster_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_topic_clusters_run ON public.topic_clusters (search_run_id);

-- -----------------------------------------------------------------------------
-- topic_cluster_members
-- -----------------------------------------------------------------------------
CREATE TABLE public.topic_cluster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_cluster_id uuid NOT NULL REFERENCES public.topic_clusters (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topic_cluster_members_unique UNIQUE (topic_cluster_id, document_id)
);

CREATE INDEX idx_topic_cluster_members_cluster ON public.topic_cluster_members (topic_cluster_id);

-- -----------------------------------------------------------------------------
-- watchlists
-- -----------------------------------------------------------------------------
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
  tracking_interval text NOT NULL CHECK (tracking_interval IN ('hourly', 'daily', 'weekly', 'monthly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  last_collected_at timestamptz,
  next_collection_at timestamptz,
  latest_mention_count integer,
  latest_avg_sentiment numeric,
  trend_movement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlists_user_topic_unique UNIQUE (user_id, topic_id)
);

CREATE INDEX idx_watchlists_user ON public.watchlists (user_id);
CREATE INDEX idx_watchlists_next_collection ON public.watchlists (next_collection_at) WHERE status = 'active';

CREATE TRIGGER watchlists_set_updated_at
BEFORE UPDATE ON public.watchlists
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- saved_reports
-- -----------------------------------------------------------------------------
CREATE TABLE public.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  topic_id uuid NOT NULL REFERENCES public.topics (id) ON DELETE RESTRICT,
  search_run_id uuid REFERENCES public.search_runs (id) ON DELETE SET NULL,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_reports_user ON public.saved_reports (user_id, created_at DESC);

CREATE TRIGGER saved_reports_set_updated_at
BEFORE UPDATE ON public.saved_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- saved_documents (articles captured in a saved report)
-- -----------------------------------------------------------------------------
CREATE TABLE public.saved_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  saved_report_id uuid NOT NULL REFERENCES public.saved_reports (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_documents_report_document_unique UNIQUE (saved_report_id, document_id)
);

CREATE INDEX idx_saved_documents_user ON public.saved_documents (user_id);

-- -----------------------------------------------------------------------------
-- processing_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  error_message text,
  search_run_id uuid REFERENCES public.search_runs (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_processing_jobs_status ON public.processing_jobs (status, created_at);

CREATE TRIGGER processing_jobs_set_updated_at
BEFORE UPDATE ON public.processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sentiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.related_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- source_platforms & topics: read-only for authenticated
CREATE POLICY source_platforms_read ON public.source_platforms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY topics_read ON public.topics
  FOR SELECT TO authenticated USING (true);

-- Global analytics: read-only for authenticated (writes via service role only)
CREATE POLICY documents_read ON public.documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY document_topics_read ON public.document_topics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY document_sentiments_read ON public.document_sentiments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY trend_snapshots_read ON public.trend_snapshots
  FOR SELECT TO authenticated USING (true);

-- search_runs
CREATE POLICY search_runs_select_own ON public.search_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY search_runs_insert_own ON public.search_runs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY search_runs_update_own ON public.search_runs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY search_runs_delete_own ON public.search_runs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- related_topics: visible if search run belongs to user
CREATE POLICY related_topics_select_own_run ON public.related_topics
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.search_runs sr
      WHERE sr.id = related_topics.search_run_id AND sr.user_id = auth.uid()
    )
  );

-- topic_clusters
CREATE POLICY topic_clusters_select_own_run ON public.topic_clusters
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.search_runs sr
      WHERE sr.id = topic_clusters.search_run_id AND sr.user_id = auth.uid()
    )
  );

-- topic_cluster_members: via cluster -> run
CREATE POLICY topic_cluster_members_select_own ON public.topic_cluster_members
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.topic_clusters tc
      JOIN public.search_runs sr ON sr.id = tc.search_run_id
      WHERE tc.id = topic_cluster_members.topic_cluster_id AND sr.user_id = auth.uid()
    )
  );

-- watchlists
CREATE POLICY watchlists_all_own ON public.watchlists
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- saved_reports
CREATE POLICY saved_reports_all_own ON public.saved_reports
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- saved_documents
CREATE POLICY saved_documents_all_own ON public.saved_documents
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- processing_jobs: read-only for user's runs (optional visibility)
CREATE POLICY processing_jobs_select_own ON public.processing_jobs
  FOR SELECT TO authenticated USING (
    search_run_id IS NULL OR EXISTS (
      SELECT 1 FROM public.search_runs sr
      WHERE sr.id = processing_jobs.search_run_id AND sr.user_id = auth.uid()
    )
  );

-- user_settings
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Seed: RSS sources
-- -----------------------------------------------------------------------------
INSERT INTO public.source_platforms (name, slug, rss_feed_url) VALUES
  ('TechCrunch', 'techcrunch', 'https://techcrunch.com/feed/'),
  ('BBC Business', 'bbc-business', 'https://feeds.bbci.co.uk/news/business/rss.xml'),
  ('The Verge', 'the-verge', 'https://www.theverge.com/rss/index.xml'),
  ('Wired', 'wired', 'https://www.wired.com/feed/rss'),
  ('Google News', 'google-news', 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en')
ON CONFLICT (slug) DO NOTHING;
