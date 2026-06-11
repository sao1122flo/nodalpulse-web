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
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight)
      if (h > 0) frame.style.height = h + "px"
    }

    const onLoad = () => {
      syncHeight()
      // Re-measure after paint: email layout may shift once the iframe has
      // a real width and fonts are applied.
      requestAnimationFrame(syncHeight)
    }

    frame.addEventListener("load", onLoad)
    return () => frame.removeEventListener("load", onLoad)
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
