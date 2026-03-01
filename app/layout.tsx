import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from "./components/Providers";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OG Reputation Space',
  description: 'On chain reputation spaces for web3, recognize, award & compose with other primites powered by Grape on Solana',
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/grape-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/grape-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/grape-180.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#0b1220",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}><Providers>{children}</Providers></body>
    </html>
  )
}
