import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "스마트 도서관 시뮬레이터 | SmartLib Sim",
  description: "시니어 친화적인 스마트 도서관 이용 연습 시뮬레이터",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans">
        <div id="app-root" className="min-h-screen flex flex-col">
          {children}
        </div>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
