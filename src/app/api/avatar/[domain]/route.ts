import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params
  
  const cleanDomain = decodeURIComponent(domain).trim().replace(/^www\./, '')
  const initial = cleanDomain ? cleanDomain.charAt(0).toUpperCase() : 'W'
  
  // Deterministic color based on domain string
  let hash = 0
  for (let i = 0; i < cleanDomain.length; i++) {
    hash = cleanDomain.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  
  const svg = `
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="hsl(${hue}, 60%, 45%)" />
  <text x="64" y="88" font-family="system-ui, sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
</svg>
  `.trim()

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
