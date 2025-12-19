import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from "./components/Providers";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reputation Dashboard | Grape DAO',
  description: 'The Reputation Dashboard, showing DAO participation metrics',
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
