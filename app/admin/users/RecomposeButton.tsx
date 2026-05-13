"use client"

import { useState, useCallback } from "react"
import { triggerRecompose, pollJobStatus } from "./actions"

type State = "idle" | "confirming" | "working" | "done" | "failed" | "timeout"

interface Props {
  userId: string
}

export function RecomposeButton({ userId }: Props) {
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")

  const handleConfirm = useCallback(async () => {
    setState("working")
    const briefDate = new Date().toISOString().slice(0, 10)
    const result = await triggerRecompose({ userId, briefDate })

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
  }, [userId])

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirming")}
        className="text-[11px] px-2 py-0.5 rounded border border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] hover:border-[var(--np-text-muted)] transition-colors"
      >
        Recompose
      </button>
    )
  }

  if (state === "confirming") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-[11px] text-[var(--np-text-muted)]">Recompose today?</span>
        <button
          onClick={handleConfirm}
          className="text-[11px] px-2 py-0.5 rounded bg-[var(--np-accent)] text-white border border-transparent"
        >
          Yes
        </button>
        <button
          onClick={() => setState("idle")}
          className="text-[11px] px-2 py-0.5 rounded border border-[var(--np-border)] text-[var(--np-text-muted)] hover:text-[var(--np-text-body)] transition-colors"
        >
          No
        </button>
      </span>
    )
  }

  if (state === "working") {
    return <span className="text-[11px] text-[var(--np-text-muted)] font-mono">working…</span>
  }

  if (state === "done") {
    return <span className="text-[11px] text-green-600 font-mono">done</span>
  }

  if (state === "timeout") {
    return (
      <span className="text-[11px] text-[var(--np-text-muted)] font-mono">
        still running — check logs
      </span>
    )
  }

  return (
    <span className="text-[11px] text-[var(--np-danger)] font-mono" title={message}>
      failed
    </span>
  )
}
