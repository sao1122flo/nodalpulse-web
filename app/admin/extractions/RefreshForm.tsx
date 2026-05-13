"use client"

import { useState, useCallback } from "react"
import { triggerRefreshExtraction, pollJobStatus } from "./actions"

type State = "idle" | "confirming" | "working" | "done" | "failed" | "timeout"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function RefreshForm() {
  const [filingId, setFilingId] = useState("")
  const [validationError, setValidationError] = useState("")
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = useCallback(() => {
    if (!UUID_RE.test(filingId.trim())) {
      setValidationError("Must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).")
      return
    }
    setValidationError("")
    setState("confirming")
  }, [filingId])

  const handleConfirm = useCallback(async () => {
    setState("working")
    const result = await triggerRefreshExtraction(filingId.trim())

    if (!result.ok) {
      setMessage(result.error)
      setState("failed")
      return
    }

    const jobId = result.value.jobId
    let ticks = 0

    const poll = async () => {
      ticks++
      if (ticks > 30) {
        setState("timeout")
        return
      }
      const status = await pollJobStatus(jobId)
      if (!status.ok) {
        setMessage(status.error)
        setState("failed")
        return
      }
      if (status.value.status === "done") {
        setState("done")
        return
      }
      if (status.value.status === "failed") {
        setMessage(status.value.error ?? "Job failed")
        setState("failed")
        return
      }
      setTimeout(poll, 2_000)
    }
    setTimeout(poll, 2_000)
  }, [filingId])

  const reset = useCallback(() => {
    setState("idle")
    setMessage("")
    setValidationError("")
  }, [])

  if (state === "confirming") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--np-text-body)]">
          Refresh extraction for filing:{" "}
          <span className="font-mono text-[var(--np-text-primary)]">{filingId.trim()}</span>?
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="text-[13px] px-3 py-1.5 rounded bg-[var(--np-accent)] text-white border border-transparent"
          >
            Confirm
          </button>
          <button
            onClick={reset}
            className="text-[13px] px-3 py-1.5 rounded border border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (state === "working") {
    return <p className="text-[13px] text-[var(--np-text-muted)] font-mono">working…</p>
  }

  if (state === "done") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-green-600 font-mono">done</p>
        <button
          onClick={reset}
          className="text-[11px] px-2 py-0.5 rounded border border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors"
        >
          Run another
        </button>
      </div>
    )
  }

  if (state === "timeout") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--np-text-muted)] font-mono">
          still running — check Railway logs
        </p>
        <button
          onClick={reset}
          className="text-[11px] px-2 py-0.5 rounded border border-[var(--np-border)] text-[var(--np-text-muted)] transition-colors"
        >
          Run another
        </button>
      </div>
    )
  }

  if (state === "failed") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--np-danger)] font-mono" title={message}>
          failed: {message}
        </p>
        <button
          onClick={reset}
          className="text-[11px] px-2 py-0.5 rounded border border-[var(--np-border)] text-[var(--np-text-muted)] transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filingId}
          onChange={e => {
            setFilingId(e.target.value)
            setValidationError("")
          }}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="font-mono text-[13px] px-3 py-1.5 rounded border border-[var(--np-border)] bg-[var(--np-surface)] text-[var(--np-text-body)] placeholder-[var(--np-text-muted)] focus:outline-none focus:border-[var(--np-accent)] w-[360px]"
        />
        <button
          onClick={handleSubmit}
          className="text-[13px] px-3 py-1.5 rounded bg-[var(--np-accent)] text-white border border-transparent"
        >
          Refresh extraction
        </button>
      </div>
      {validationError && (
        <p className="text-[11px] text-[var(--np-danger)] font-mono">{validationError}</p>
      )}
    </div>
  )
}
