'use client'

import { AuthProvider } from '@/context/AuthContext'
import { NotificationManager } from '@/components/NotificationManager'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <AuthProvider>
        <NotificationManager />
        {children}
      </AuthProvider>
    </ThemeProvider>
  )
}
