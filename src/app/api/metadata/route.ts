import { NextRequest, NextResponse } from 'next/server'

const PLATFORM_DOMAINS = [
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
  'onrender.com',
  'pages.dev',
  'github.io',
  'firebaseapp.com',
  'web.app'
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const urlParam = searchParams.get('url')

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  const urlStr = urlParam.startsWith('http') ? urlParam : `https://${urlParam}`
  let url: URL
  try {
    url = new URL(urlStr)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const cleanDomain = url.hostname.replace(/^www\./, '')
  const isPlatformDomain = PLATFORM_DOMAINS.some(d => cleanDomain.endsWith(d))
  
  const origin = url.origin
  const avatarFallback = `/api/avatar/${encodeURIComponent(cleanDomain)}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3s timeout
    
    // Fetch the HTML to look for custom favicon
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReplaceMeBot/1.0; +https://replaceme.lol)' },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (res.ok) {
      const html = await res.text()
      
      // Regex to find <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
      const match = html.match(/<link[^>]*rel=["']?(?:shortcut )?icon["']?[^>]*href=["']?([^"'>\s]+)["']?[^>]*>/i)
                 || html.match(/<link[^>]*href=["']?([^"'>\s]+)["']?[^>]*rel=["']?(?:shortcut )?icon["']?[^>]*>/i)

      if (match && match[1]) {
        let iconUrl = match[1]
        // Fix relative URLs
        if (iconUrl.startsWith('//')) {
          iconUrl = `https:${iconUrl}`
        } else if (iconUrl.startsWith('/')) {
          iconUrl = `${origin}${iconUrl}`
        } else if (!iconUrl.startsWith('http')) {
          iconUrl = `${url.toString().replace(/\/$/, '')}/${iconUrl}`
        }
        
        return NextResponse.json({ logoUrl: iconUrl })
      }
    }
  } catch (e) {
    // Ignore fetch errors, fallback below
  }

  // If no custom favicon found or fetch failed
  if (isPlatformDomain) {
    return NextResponse.json({ logoUrl: avatarFallback })
  }

  // If it's a custom domain, Google's service is an okay fallback
  return NextResponse.json({
    logoUrl: `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${cleanDomain}&size=128`
  })
}
