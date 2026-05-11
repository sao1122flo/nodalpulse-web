"use client"

import { useRef, useEffect } from "react"

export default function BriefFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    const resize = () => {
      const doc = frame.contentDocument
      if (doc?.body) {
        frame.style.height = doc.body.scrollHeight + "px"
      }
    }
    frame.addEventListener("load", resize)
    return () => frame.removeEventListener("load", resize)
  }, [html])

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      style={{ width: "100%", border: "none", minHeight: 400 }}
      title="Brief content"
    />
  )
}
