import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import Script from "next/script"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { template: "%s — NodalPulse", default: "NodalPulse — Regulatory Intelligence for US Power Markets" },
  description: "Daily brief for US power market proceedings — ERCOT, CAISO, and PJM — cited, sourced, on your desk by 06:00 CT every weekday. Track dockets, never miss a filing.",
  openGraph: {
    type: "website",
    url: "https://app.nodalpulse.com",
    siteName: "NodalPulse",
    title: "NodalPulse — Regulatory Intelligence for US Power Markets",
    description: "Daily brief for US power market proceedings — ERCOT, CAISO, and PJM — cited, sourced, on your desk by 06:00 CT every weekday. Track dockets, never miss a filing.",
    images: [
      {
        url: "https://nodalpulse.com/og-default.png",
        width: 1200,
        height: 630,
        alt: "NodalPulse — Regulatory Intelligence for US Power Markets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NodalPulse — Regulatory Intelligence for US Power Markets",
    description: "Daily brief for US power market proceedings — ERCOT, CAISO, and PJM — cited, sourced, on your desk by 06:00 CT every weekday. Track dockets, never miss a filing.",
    images: ["https://nodalpulse.com/og-default.png"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head />
      <body className="min-h-full bg-[var(--np-surface)] text-[var(--np-text-primary)]">
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MZZFFHWT');`,
          }}
        />
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MZZFFHWT"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
    </html>
  )
}
