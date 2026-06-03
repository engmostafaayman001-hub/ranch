export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}
