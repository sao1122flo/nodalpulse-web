"use client"

import { useRef, useEffect } from "react"

export default function BriefFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    const syncHeight = () => {
      const doc = frame.contentDocument
      if (!doc?.body) return
      // Use both body and documentElement to handle email HTML quirks
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight)
      frame.style.height = h + "px"
    }
    frame.addEventListener("load", syncHeight)
    return () => frame.removeEventListener("load", syncHeight)
  }, [html])

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      // allow-same-origin: required so parent can read contentDocument.scrollHeight
      // allow-scripts intentionally omitted: email HTML needs no JS
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width: "100%", border: "none", display: "block", overflow: "hidden" }}
      title="Brief content"
    />
  )
}
