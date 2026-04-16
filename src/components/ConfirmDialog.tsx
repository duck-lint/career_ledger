import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Called when the user confirms. May return a promise; a spinner label is
      shown while it resolves. The dialog closes only after success. */
  onConfirm: () => void | Promise<void>
}

/**
 * Controlled confirmation dialog that wraps the destructive/cancel button
 * pattern. Handles its own submitting state so callers don't have to
 * re-implement it every time.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  // Reset submitting state whenever the dialog re-opens so a second attempt
  // after an error starts clean.
  useEffect(() => {
    if (open) setSubmitting(false)
  }, [open])

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (submitting && !next) return
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">
              Confirm this action.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            className={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            onClick={(event) => {
              event.preventDefault()
              void handleConfirm()
            }}
          >
            {submitting ? `${confirmLabel}...` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
