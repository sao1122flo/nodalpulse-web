"use client"

import { useRef, useEffect } from "react"

export default function BriefFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

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

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      // allow-same-origin: required so parent can read contentDocument.scrollHeight
      // allow-scripts intentionally omitted: email HTML needs no JS
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width: "100%", border: "none", display: "block", overflow: "hidden", minHeight: 400 }}
      title="Brief content"
    />
  )
}
