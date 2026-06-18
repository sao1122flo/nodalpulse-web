"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { sendQuestion } from "@/app/(app)/chat/actions"
import type { QnaCitation } from "@/lib/services-client"
import { Citation } from "@/components/Citation"

interface Props {
  limitPerDay: number
  usedToday: number
}

interface Answer {
  question: string
  text: string
  citations: QnaCitation[]
}

export function AskTheRecord({ limitPerDay, usedToday }: Props) {
  const [question, setQuestion] = useState("")
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [used, setUsed] = useState(usedToday)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const unavailable = limitPerDay === 0
  const remaining = limitPerDay - used
  const blocked = unavailable || remaining <= 0

  async function submit() {
    const q = question.trim()
    if (!q || isPending || blocked) return

    setError(null)
    setQuestion("")
    setPendingQuestion(q)

    startTransition(async () => {
      const result = await sendQuestion(q, conversationId)

      if (!result.ok) {
        if (result.error === "__rate_limit__") {
          setError(`Daily limit reached (${limitPerDay} questions). Resets at midnight CT.`)
        } else if (result.error === "__no_predicates__") {
          setError("Track a docket first — Ask the Record searches your tracked filings.")
        } else if (result.error === "__unavailable__") {
          setError("Ask the Record is not available on your current plan.")
        } else {
          setError(result.error)
        }
        return
      }

      const { answer: text, citations, conversation_id, used_today } = result.value
      if (!conversationId) setConversationId(conversation_id)
      setUsed(used_today)
      setPendingQuestion(null)
      setAnswer({ question: q, text, citations })
    })
  }

  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] overflow-hidden">
      {/* Bar header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--np-border)]">
        <span className="text-[12px] font-semibold text-[var(--np-text-primary)] tracking-tight">
          Ask the Record
        </span>
        <span className="text-[11px] text-[var(--np-text-muted)]">
          · searches your tracked filings
        </span>
        <div className="ml-auto flex items-center gap-3">
          {!unavailable && (
            <span className="text-[11px] text-[var(--np-text-muted)]">
              {remaining > 0 ? `${remaining} left today` : "limit reached"}
            </span>
          )}
          <Link
            href="/chat"
            className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Full history →
          </Link>
        </div>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 px-4 py-3">
        <textarea
          ref={inputRef}
          value={question}
          onChange={e => {
            setQuestion(e.target.value)
            // auto-grow: reset to auto then set to scrollHeight
            const el = e.target
            el.style.height = "auto"
            el.style.height = Math.min(el.scrollHeight, 100) + "px"
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={
            unavailable
              ? "Upgrade to ask questions about your filings"
              : blocked
              ? "Daily limit reached — resets at midnight CT"
              : "Ask anything about your tracked matters… (Enter)"
          }
          disabled={isPending || blocked}
          rows={1}
          style={{ resize: "none", minHeight: "34px", maxHeight: "100px", overflow: "hidden" }}
          className="
            flex-1 bg-transparent text-[13px] text-[var(--np-text-body)]
            placeholder:text-[var(--np-text-muted)]
            focus:outline-none disabled:opacity-50
          "
        />
        <button
          type="button"
          onClick={submit}
          disabled={!question.trim() || isPending || blocked}
          className="
            flex-shrink-0 px-3 py-1.5 rounded-[var(--np-radius-md)]
            bg-[var(--np-accent)] text-white
            text-[12px] font-medium
            hover:bg-[var(--np-accent-hover)] transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPending ? "…" : "Ask"}
        </button>
      </div>

      {/* Loading */}
      {isPending && (
        <div className="px-4 pb-3 space-y-1">
          {pendingQuestion && (
            <p className="text-[12px] font-medium text-[var(--np-text-body)]">
              Q: {pendingQuestion}
            </p>
          )}
          <p className="text-[12px] text-[var(--np-text-muted)]">
            Searching your filings…
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-3 space-y-1.5">
          {pendingQuestion && (
            <p className="text-[12px] font-medium text-[var(--np-text-body)]">
              Q: {pendingQuestion}
            </p>
          )}
          <div className="rounded-[var(--np-radius-md)] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.04)] px-3 py-2 text-[12px] text-[var(--np-danger)]">
            {error}
          </div>
        </div>
      )}

      {/* Answer */}
      {answer && !isPending && (
        <div className="border-t border-[var(--np-border)] px-4 py-4">
          {/* Question echo */}
          <p className="text-[11px] text-[var(--np-text-muted)] mb-2">
            Q: {answer.question}
          </p>

          {/* Answer text */}
          <p className="text-[13px] text-[var(--np-text-body)] leading-relaxed whitespace-pre-wrap mb-3">
            {answer.text}
          </p>

          {/* Citations */}
          {answer.citations.length > 0 && (
            <div className="border-t border-[var(--np-border)] pt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-[var(--np-text-muted)] uppercase tracking-wider mb-1.5">
                Sources
              </p>
              {answer.citations.map(c => (
                <div key={c.filing_id} className="flex flex-wrap items-center gap-2 text-[12px]">
                  <Citation c={c} />
                  {c.title && (
                    <span className="text-[var(--np-text-body)] min-w-0 truncate max-w-[280px]">
                      {c.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Continue in full chat */}
          <div className="mt-3 pt-3 border-t border-[var(--np-border)]">
            <Link
              href={conversationId ? `/chat?conv=${conversationId}` : "/chat"}
              className="text-[11px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
            >
              Continue this conversation in Ask the Record →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
