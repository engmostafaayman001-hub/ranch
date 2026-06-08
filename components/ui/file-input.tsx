import * as React from "react"

import { cn } from "@/lib/utils"

export type FileInputProps = React.InputHTMLAttributes<HTMLInputElement>

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, ...props }, ref) => (
    <input
      type="file"
      className={cn(
        "block h-10 w-full min-w-0 max-w-full overflow-hidden truncate rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:mr-3 file:max-w-[48%] file:truncate file:border-0 file:bg-slate-100 file:text-slate-700 file:font-medium file:cursor-pointer placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:file:bg-slate-800 dark:file:text-slate-400 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
FileInput.displayName = "FileInput"

export { FileInput }
