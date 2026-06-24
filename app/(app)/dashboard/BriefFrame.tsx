"use client"

import { useRef, useEffect } from "react"

export default function BriefFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

  // Height measurement
  useEffect(() => {
    const frame = ref.current
    if (!frame) return

    const measure = () => {
      const doc = frame.contentDocument
      if (!doc?.body) return
      const h = doc.documentElement.scrollHeight
      if (h > 0) frame.style.height = h + "px"
    }

    // srcDoc content is available synchronously — no need to wait for load
    measure()

    // Backup: re-measure if the iframe ever reloads
    frame.addEventListener("load", measure)

    // Catch late font/image reflow inside the iframe
    let ro: ResizeObserver | null = null
    if (frame.contentDocument?.body) {
      ro = new ResizeObserver(measure)
      ro.observe(frame.contentDocument.body)
    }

    return () => {
      frame.removeEventListener("load", measure)
      ro?.disconnect()
    }
  }, [html])

  // Citation click → open docket side panel via ?docket= URL param.
  // Uses contentDocument (allow-same-origin in sandbox) — no scripts inside iframe needed.
  useEffect(() => {
    const frame = ref.current
    if (!frame) return

    function attachHandlers() {
      const doc = frame?.contentDocument
      if (!doc) return
      doc.querySelectorAll<HTMLAnchorElement>("a.citation[data-docket-number]").forEach(link => {
        if (link.dataset.citationBound) return
        link.dataset.citationBound = "1"
        link.addEventListener("click", e => {
          const docket = link.dataset.docketNumber
          if (!docket) return
          e.preventDefault()
          const u = new URL(window.location.href)
          u.searchParams.set("docket", docket)
          window.history.pushState({}, "", u.pathname + "?" + u.searchParams.toString())
          // Fire a popstate-equivalent so Next.js router picks up the param change
          window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }))
        })
      })
    }

    // Run now (srcDoc already rendered) and on any future reload
    attachHandlers()
    frame.addEventListener("load", attachHandlers)
    return () => frame.removeEventListener("load", attachHandlers)
  }, [html])

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      // allow-same-origin: required so parent can read contentDocument for height + citation clicks
      // allow-scripts intentionally omitted: brief HTML needs no JS
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width: "100%", border: "none", display: "block", overflow: "hidden", minHeight: 400 }}
      title="Brief content"
    />
  )
}
