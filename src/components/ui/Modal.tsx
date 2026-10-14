"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  const titleId = React.useId()
  const descriptionId = React.useId()

  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Move focus into the dialog (first focusable, else the dialog itself)
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialog)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== "Tab" || !dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-canvas text-ink p-6 sm:p-8 outline-none animate-in zoom-in-95 duration-200",
          className
        )}
      >
        {(title || description) && (
          <div className="mb-6 space-y-1">
            {title && <h2 id={titleId} className="text-tagline text-ink">{title}</h2>}
            {description && <p id={descriptionId} className="text-caption text-ink-48">{description}</p>}
          </div>
        )}

        <div>{children}</div>
      </div>
    </div>
  )
}
