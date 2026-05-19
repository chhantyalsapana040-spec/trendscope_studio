/**
 * TypeScript types aligned with `supabase/migrations/fulldatabaseschema.sql` (single source of truth).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TrackingInterval = "hourly" | "daily" | "weekly" | "monthly";
export type WatchlistStatus = "active" | "paused";
export type SearchRunStatus = "pending" | "processing" | "completed" | "failed";
export type SentimentLabel = "positive" | "neutral" | "negative";
export type ProcessingJobStatus = "queued" | "running" | "completed" | "failed";
export type ThemePreference = "light" | "dark" | "system";
export type ExportFormat = "pdf" | "csv" | "json";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourcePlatform {
  id: string;
  name: string;
  slug: string;
  rss_feed_url: string | null;
  created_at: string;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Document {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  content_preview: string | null;
  source_platform_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentTopic {
  id: string;
  document_id: string;
  topic_id: string;
  relevance_score: number;
  created_at: string;
}

export interface DocumentSentiment {
  id: string;
  document_id: string;
  label: SentimentLabel;
  score: number;
  model_version: string;
  created_at: string;
}

export interface TrendSnapshot {
  id: string;
  topic_id: string;
  snapshot_date: string;
  mention_count: number;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  avg_sentiment_score: number | null;
  growth_metric: number | null;
  created_at: string;
}

export interface SearchRun {
  id: string;
  user_id: string;
  topic_id: string;
  query_text: string;
  status: SearchRunStatus;
  filters: Json;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface RelatedTopic {
  id: string;
  search_run_id: string;
  topic_id: string;
  related_topic_id: string;
  similarity_score: number;
  created_at: string;
}

export interface TopicCluster {
  id: string;
  search_run_id: string;
  label: string;
  cluster_index: number;
  created_at: string;
}

export interface TopicClusterMember {
  id: string;
  topic_cluster_id: string;
  document_id: string;
  created_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  topic_id: string;
  tracking_interval: TrackingInterval;
  status: WatchlistStatus;
  last_collected_at: string | null;
  next_collection_at: string | null;
  latest_mention_count: number | null;
  latest_avg_sentiment: number | null;
  trend_movement: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedReport {
  id: string;
  user_id: string;
  title: string;
  topic_id: string;
  search_run_id: string | null;
  report_json: Json;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedDocument {
  id: string;
  user_id: string;
  saved_report_id: string;
  document_id: string;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  job_type: string;
  payload: Json;
  status: ProcessingJobStatus;
  error_message: string | null;
  search_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  dashboard_default_category: string;
  dashboard_default_date_range: string;
  watchlist_default_interval: TrackingInterval;
  notifications_trend_alerts: boolean;
  export_default_format: ExportFormat;
  theme: ThemePreference;
  data_source_preferences: Json;
  created_at: string;
  updated_at: string;
}

type Table<Row, Insert, Update> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

/** Supabase `Database` generic shape for typed clients */
export interface Database {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        { id: string; full_name?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string },
        Partial<Profile>
      >;
      source_platforms: Table<
        SourcePlatform,
        { id?: string; name: string; slug: string; rss_feed_url?: string | null; created_at?: string },
        Partial<SourcePlatform>
      >;
      topics: Table<
        Topic,
        { id?: string; name: string; slug: string; created_at?: string },
        Partial<Topic>
      >;
      documents: Table<
        Document,
        {
          id?: string;
          url: string;
          title: string;
          summary?: string | null;
          content_preview?: string | null;
          source_platform_id?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Document>
      >;
      document_topics: Table<
        DocumentTopic,
        { id?: string; document_id: string; topic_id: string; relevance_score?: number; created_at?: string },
        Partial<DocumentTopic>
      >;
      document_sentiments: Table<
        DocumentSentiment,
        { id?: string; document_id: string; label: SentimentLabel; score: number; model_version?: string; created_at?: string },
        Partial<DocumentSentiment>
      >;
      trend_snapshots: Table<
        TrendSnapshot,
        {
          id?: string;
          topic_id: string;
          snapshot_date: string;
          mention_count?: number;
          positive_count?: number;
          neutral_count?: number;
          negative_count?: number;
          avg_sentiment_score?: number | null;
          growth_metric?: number | null;
          created_at?: string;
        },
        Partial<TrendSnapshot>
      >;
      search_runs: Table<
        SearchRun,
        {
          id?: string;
          user_id: string;
          topic_id: string;
          query_text: string;
          status?: SearchRunStatus;
          filters?: Json;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        },
        Partial<SearchRun>
      >;
      related_topics: Table<
        RelatedTopic,
        {
          id?: string;
          search_run_id: string;
          topic_id: string;
          related_topic_id: string;
          similarity_score?: number;
          created_at?: string;
        },
        Partial<RelatedTopic>
      >;
      topic_clusters: Table<
        TopicCluster,
        { id?: string; search_run_id: string; label: string; cluster_index?: number; created_at?: string },
        Partial<TopicCluster>
      >;
      topic_cluster_members: Table<
        TopicClusterMember,
        { id?: string; topic_cluster_id: string; document_id: string; created_at?: string },
        Partial<TopicClusterMember>
      >;
      watchlists: Table<
        Watchlist,
        {
          id?: string;
          user_id: string;
          topic_id: string;
          tracking_interval: TrackingInterval;
          status?: WatchlistStatus;
          last_collected_at?: string | null;
          next_collection_at?: string | null;
          latest_mention_count?: number | null;
          latest_avg_sentiment?: number | null;
          trend_movement?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<Watchlist>
      >;
      saved_reports: Table<
        SavedReport,
        {
          id?: string;
          user_id: string;
          title: string;
          topic_id: string;
          search_run_id?: string | null;
          report_json?: Json;
          ai_summary?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<SavedReport>
      >;
      saved_documents: Table<
        SavedDocument,
        { id?: string; user_id: string; saved_report_id: string; document_id: string; created_at?: string },
        Partial<SavedDocument>
      >;
      processing_jobs: Table<
        ProcessingJob,
        {
          id?: string;
          job_type: string;
          payload?: Json;
          status?: ProcessingJobStatus;
          error_message?: string | null;
          search_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<ProcessingJob>
      >;
      user_settings: Table<
        UserSettings,
        {
          id?: string;
          user_id: string;
          dashboard_default_category?: string;
          dashboard_default_date_range?: string;
          watchlist_default_interval?: TrackingInterval;
          notifications_trend_alerts?: boolean;
          export_default_format?: ExportFormat;
          theme?: ThemePreference;
          data_source_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        },
        Partial<UserSettings>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
