export default function AppLoading() {
  return (
    <main className="min-h-screen bg-white p-6 dark:bg-slate-950" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </main>
  )
}
