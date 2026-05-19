"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/app-providers";

type Article = { id: string; title: string; url: string; publishedAt: string | null };

type Save = {
  id: string;
  title: string;
  createdAt: string;
  articleCount: number;
  articles: Article[];
};

type TopicGroup = { topicId: string; topicName: string; saves: Save[] };

export default function SavedDocumentsPage() {
  const toast = useToast();
  const [topics, setTopics] = useState<TopicGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-articles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setTopics(data.topics ?? []);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">Saved documents</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Article sets you save from the dashboard are grouped by search topic. Open any link in a new tab to read the
          original piece.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-r-transparent" />
          <p className="mt-4 text-center text-sm text-slate-500">Loading saved libraries…</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          No saved document sets yet. Run an analysis on the dashboard, then use &quot;Save documents&quot; to capture the
          article list for that topic.
        </div>
      ) : (
        <div className="space-y-8">
          {topics.map((t) => (
            <section key={t.topicId} className="rounded-2xl border border-slate-200 bg-white p-4 card-shadow dark:border-slate-800 dark:bg-slate-950 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.topicName}</h2>
              <div className="mt-4 space-y-6">
                {t.saves.map((s) => (
                  <div key={s.id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.title}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(s.createdAt).toLocaleString()} · {s.articleCount} articles
                      </div>
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {s.articles.map((a) => (
                        <li key={a.id}>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-indigo-700 transition hover:border-indigo-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-indigo-300 dark:hover:border-indigo-500/40"
                          >
                            <span className="font-medium text-slate-900 dark:text-white">{a.title}</span>
                            {a.publishedAt ? (
                              <span className="mt-1 block text-xs text-slate-500">
                                {new Date(a.publishedAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
