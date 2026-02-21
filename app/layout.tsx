import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from "./components/Providers";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OG Reputation Space',
  description: 'On chain reputation spaces for web3, recognize, award & compose with other primites powered by Grape',
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
