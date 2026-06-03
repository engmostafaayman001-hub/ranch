import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const dialogVariants = cva(
  "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  {
    variants: {},
    defaultVariants: {},
  }
)

export type DialogProps = React.HTMLAttributes<HTMLDivElement>

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(dialogVariants(), className)} {...props} />
  )
)
Dialog.displayName = "Dialog"

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = "DialogOverlay"

export { Dialog, DialogOverlay }
