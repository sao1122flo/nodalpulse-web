"use client"

import { useRef, useState, useTransition } from "react"
import { sendQuestion } from "./actions"
import type { QnaCitation } from "@/lib/services-client"

interface Turn {
  question: string
  answer: string
  citations: QnaCitation[]
}

interface Props {
  initialLimit: number
  usedToday: number
  marketRoles: string[]
}

function exampleQuestions(marketRoles: string[]): string[] {
  const role = marketRoles[0]?.toLowerCase() ?? ""
  if (role.includes("compliance")) {
    return [
      "What deadlines are coming up in my tracked dockets?",
      "Are there any pending PUCT orders affecting compliance filings?",
      "What relief is being requested in recent filings?",
    ]
  }
  if (role.includes("regulatory") || role.includes("attorney") || role.includes("counsel")) {
    return [
      "What are the key parties in my tracked dockets?",
      "Are there any proposals for decision issued recently?",
      "Summarize the most recent order in my tracked filings.",
    ]
  }
  return [
    "What are the key deadlines across my tracked dockets?",
    "Summarize the most significant filings this month.",
    "Are there any pending orders or proposals for decision?",
  ]
}

function CitationLink({ c }: { c: QnaCitation }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[12px]">
      <span className="text-[var(--np-text-muted)] font-mono">
        {c.docket_number ? `PUCT ${c.docket_number}` : c.filing_id.slice(0, 8)}
      </span>
      <span className="text-[var(--np-text-muted)]">—</span>
      <span className="text-[var(--np-text-body)] max-w-[260px] truncate">{c.title}</span>
      <span className="flex items-center gap-1.5">
        {c.source_url && (
          <a
            href={c.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Source →
          </a>
        )}
        {c.docket_number && (
          <a
            href={`/dockets/${encodeURIComponent(c.docket_number)}`}
            className="text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            Docket →
          </a>
        )}
      </span>
    </span>
  )
}

export function ChatClient({ initialLimit, usedToday, marketRoles }: Props) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [noPredicatesPayload, setNoPredicatesPayload] = useState<{
    message: string
    actions: Array<{ label: string; href: string }>
  } | null>(null)
  const [used, setUsed] = useState(usedToday)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const remaining = initialLimit - used

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 50)
  }

  async function submit(q: string) {
    const trimmed = q.trim()
    if (!trimmed || isPending) return

    setQuestion("")
    setError(null)
    setNoPredicatesPayload(null)

    startTransition(async () => {
      const result = await sendQuestion(trimmed, conversationId)

      if (!result.ok) {
        if (result.error === "__rate_limit__") {
          const payload = result.errorPayload as { resets_at?: string } | undefined
          const resetsAt = payload?.resets_at
            ? new Date(payload.resets_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Chicago",
                timeZoneName: "short",
              })
            : "midnight CT"
          setError(`Daily limit reached (${initialLimit} questions). Resets at ${resetsAt}.`)
        } else if (result.error === "__no_predicates__") {
          const payload = result.errorPayload as {
            message?: string
            actions?: Array<{ label: string; href: string }>
          } | undefined
          setNoPredicatesPayload({
            message: payload?.message ?? "Set up tracked dockets or saved searches to use Q&A.",
            actions: payload?.actions ?? [
              { label: "Track a docket", href: "/dockets" },
              { label: "Create a saved search", href: "/dashboard" },
            ],
          })
        } else if (result.error === "__unavailable__") {
          setError("Q&A is not available on your current plan.")
        } else {
          setError(result.error)
        }
        scrollToBottom()
        return
      }

      const { answer, citations, conversation_id, used_today } = result.value
      if (!conversationId) setConversationId(conversation_id)
      setUsed(used_today)
      setTurns(prev => [...prev, { question: trimmed, answer, citations }])
      scrollToBottom()
    })
  }

  const examples = exampleQuestions(marketRoles)
  const showEmpty = turns.length === 0 && !isPending && !error && !noPredicatesPayload

  return (
    <div className="flex flex-col h-full">
      {/* Usage counter */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[var(--np-text-muted)] text-[12px]">
          {remaining > 0
            ? `${remaining} of ${initialLimit} questions remaining today · resets at midnight CT`
            : `Daily limit reached (${initialLimit}) · resets at midnight CT`}
        </p>
      </div>

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-5 mb-4">
        {showEmpty && (
          <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-5">
            <p className="text-[var(--np-text-body)] text-[13px] font-medium mb-3">
              Ask anything about your tracked filings
            </p>
            <div className="space-y-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => submit(ex)}
                  className="
                    block w-full text-left text-[13px] px-3 py-2
                    rounded-[var(--np-radius-md)]
                    border border-[var(--np-border)]
                    text-[var(--np-text-body)]
                    hover:border-[var(--np-accent)] hover:text-[var(--np-text-strong)]
                    transition-colors
                  "
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-3">
            {/* Question bubble */}
            <div className="flex justify-end">
              <div
                className="
                  max-w-[80%] px-4 py-2.5 rounded-[var(--np-radius-lg)]
                  bg-[var(--np-accent)] text-[var(--np-accent-fg)]
                  text-[13px] leading-relaxed
                "
              >
                {turn.question}
              </div>
            </div>

            {/* Answer card */}
            <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
              <p className="text-[var(--np-text-body)] text-[13px] leading-relaxed whitespace-pre-wrap">
                {turn.answer}
              </p>

              {turn.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--np-border)] space-y-1.5">
                  <p className="text-[var(--np-text-muted)] text-[11px] uppercase tracking-wide font-medium mb-2">
                    Sources
                  </p>
                  {turn.citations.map((c) => (
                    <CitationLink key={c.filing_id} c={c} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div
              className="
                px-4 py-2.5 rounded-[var(--np-radius-lg)]
                border border-[var(--np-border)] bg-[var(--np-surface-elevated)]
                text-[13px] text-[var(--np-text-muted)]
              "
            >
              Searching your filings…
            </div>
          </div>
        )}

        {noPredicatesPayload && (
          <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-5 py-4">
            <p className="text-[var(--np-text-body)] text-[13px] mb-3">
              {noPredicatesPayload.message}
            </p>
            <div className="flex flex-wrap gap-2">
              {noPredicatesPayload.actions.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="
                    inline-flex items-center px-3 py-1.5
                    rounded-[var(--np-radius-md)]
                    border border-[var(--np-accent)]
                    text-[var(--np-accent-text)] text-[12px]
                    hover:bg-[var(--np-accent)] hover:text-white transition-colors
                  "
                >
                  {a.label} →
                </a>
              ))}
            </div>
          </div>
        )}

        {error && !noPredicatesPayload && (
          <div
            className="
              rounded-[var(--np-radius-md)] border border-[rgba(239,68,68,0.25)]
              bg-[rgba(239,68,68,0.04)] px-4 py-3
              text-[var(--np-danger)] text-[13px]
            "
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="
          flex items-end gap-2 rounded-[var(--np-radius-lg)]
          border border-[var(--np-border)] bg-[var(--np-surface-elevated)]
          px-3 py-2.5
          focus-within:border-[var(--np-accent)]
          transition-colors
        "
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit(question)
            }
          }}
          placeholder={
            remaining <= 0
              ? "Daily limit reached — resets at midnight CT"
              : "Ask about your tracked filings… (Enter to send)"
          }
          disabled={isPending || remaining <= 0}
          rows={1}
          style={{ resize: "none", minHeight: "36px", maxHeight: "120px", overflow: "auto" }}
          className="
            flex-1 bg-transparent text-[13px] text-[var(--np-text-body)]
            placeholder:text-[var(--np-text-muted)]
            focus:outline-none disabled:opacity-50
          "
        />
        <button
          type="button"
          onClick={() => submit(question)}
          disabled={!question.trim() || isPending || remaining <= 0}
          className="
            flex-shrink-0 px-3 py-1.5 rounded-[var(--np-radius-md)]
            bg-[var(--np-accent)] text-[var(--np-accent-fg)]
            text-[12px] font-medium
            hover:bg-[var(--np-accent-hover)] transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPending ? "…" : "Send"}
        </button>
      </div>
    </div>
  )
}
