import Link from "next/link";

const features = [
  {
    title: "Trend Search",
    body: "Query the signal graph across sources to surface what is rising, where, and why it matters.",
  },
  {
    title: "Sentiment Insights",
    body: "Understand emotional tone and polarity so you can interpret momentum with context, not noise.",
  },
  {
    title: "Topic Clustering",
    body: "Group related narratives automatically to see sub-trends, overlaps, and white-space opportunities.",
  },
  {
    title: "Watchlist Tracking",
    body: "Pin topics you care about and get a living timeline of snapshots as the story evolves.",
  },
  {
    title: "Saved Reports",
    body: "Export-ready summaries you can revisit for social content, stakeholder decks, or research archives.",
  },
  {
    title: "Visual Analytics",
    body: "Charts that communicate growth and sentiment clearly — tuned for presentations and critique.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen grid-bg text-slate-900 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
              TS
            </span>
            <span className="text-sm font-semibold">TrendScope Studio</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <Link className="text-indigo-600 dark:text-indigo-300" href="/#top">
              Home
            </Link>
            <Link href="/#features">Features</Link>
            <Link href="/login">Login</Link>
            <Link
              href="/register"
              className="rounded-xl bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
              Trend intelligence workspace
            </div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl dark:text-white">
              Discover, analyse and track emerging trends
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 dark:text-slate-300">
              TrendScope Studio helps you move from curiosity to evidence: search topics, interpret sentiment and clusters,
              then monitor what changes on your personal dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white btn-gradient shadow-lg"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                View Dashboard
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 card-shadow dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                Topic overview
              </div>
              <div className="mt-2 text-lg font-semibold">Your analysed topic</div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-900" />
                <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-900" />
                <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-900" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-900" />
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-900" />
                <div className="h-2 w-2/3 rounded bg-slate-100 dark:bg-slate-900" />
              </div>
            </div>
            <div className="absolute -bottom-6 right-2 w-[min(100%,320px)] rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-2xl">
              <div className="text-xs text-slate-400">Watchlist</div>
              <div className="mt-2 text-sm font-semibold">Tracked topics appear here</div>
              <div className="mt-1 text-xs text-slate-500">Updates from your workspace</div>
            </div>
          </div>
        </div>

        <section id="features" className="mt-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Everything you need for trend analysis</h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              From discovery to visualisation, TrendScope Studio is designed like a professional SaaS analytics platform —
              polished UX, scalable data, and practical insight generation.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 card-shadow transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                  ✦
                </div>
                <div className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{f.title}</div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-3xl border border-slate-200 bg-white p-8 card-shadow dark:border-slate-800 dark:bg-slate-950 md:p-10">
          <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">How it works</h3>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Sign in and run a structured trend analysis with sources and a date window.</li>
            <li>TrendScope collects public RSS articles, scores sentiment, and clusters narratives.</li>
            <li>Save reports, compare historical runs, and schedule watchlist snapshots over time.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl btn-gradient px-5 py-2.5 text-sm font-semibold text-white">
              Create account
            </Link>
            <Link href="/login" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold dark:border-slate-800">
              Log in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} TrendScope Studio
      </footer>
    </div>
  );
}
