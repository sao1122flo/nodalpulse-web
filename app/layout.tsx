import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { template: "%s — NodalPulse", default: "NodalPulse" },
  description: "Regulatory intelligence for ERCOT participants.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--np-surface)] text-[var(--np-text-primary)]">
        {children}
      </body>
    </html>
  )
}
