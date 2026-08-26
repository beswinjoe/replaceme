import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

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

function resolveUrl(relativeUrl: string, baseUrl: URL): string {
  try {
    if (relativeUrl.startsWith('//')) {
      return `https:${relativeUrl}`
    }
    return new URL(relativeUrl, baseUrl).toString()
  } catch {
    return relativeUrl
  }
}

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) {
       const ct = res.headers.get('content-type')
       if (ct && (ct.startsWith('image/') || ct === 'application/octet-stream' || ct === 'image/svg+xml')) {
         return true
       }
       // If no content-type or unknown, it might still be an image.
       // Let's assume true if it was a 2xx response and it doesn't clearly say text/html
       if (ct && ct.includes('text/html')) return false
       return true
    }
  } catch {
    return false
  }
  return false
}

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
  
  const avatarFallback = `/api/avatar/${encodeURIComponent(cleanDomain)}`

  let websiteName = cleanDomain
  let logoUrl = ''
  let logoSource = 'fallback'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReplaceMeBot/1.0; +https://replaceme.lol)' },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (res.ok) {
      const html = await res.text()
      const $ = cheerio.load(html)
      
      // 1. Resolve Website Name
      const ogSiteName = $('meta[property="og:site_name"]').attr('content')
      const appName = $('meta[name="application-name"]').attr('content')
      const title = $('title').text()
      
      if (ogSiteName) {
        websiteName = ogSiteName.trim()
      } else if (appName) {
        websiteName = appName.trim()
      } else if (title) {
        // Remove common title suffixes
        websiteName = title.split('|')[0].split('-')[0].trim()
      }

      // 2. Resolve Logo from HTML tags
      const iconSelectors = [
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
        'link[rel="icon"][sizes="512x512"]',
        'link[rel="icon"][sizes="192x192"]',
        'link[rel="icon"][sizes="180x180"]',
        'link[rel="icon"][type="image/svg+xml"]',
        'link[rel="shortcut icon"]',
        'link[rel="icon"]',
      ]
      
      let candidateLogo = ''
      
      // First try to check for a manifest
      const manifestHref = $('link[rel="manifest"]').attr('href')
      if (manifestHref) {
        try {
          const manifestUrl = resolveUrl(manifestHref, url)
          const mController = new AbortController()
          const mTimeout = setTimeout(() => mController.abort(), 1500)
          const mRes = await fetch(manifestUrl, { signal: mController.signal })
          clearTimeout(mTimeout)
          
          if (mRes.ok) {
            const manifest = await mRes.json()
            if (manifest.icons && Array.isArray(manifest.icons) && manifest.icons.length > 0) {
              // Prefer largest or SVG
              const bestIcon = manifest.icons.sort((a: any, b: any) => {
                if (a.type === 'image/svg+xml') return -1
                if (b.type === 'image/svg+xml') return 1
                const sizeA = parseInt(a.sizes?.split('x')[0] || '0')
                const sizeB = parseInt(b.sizes?.split('x')[0] || '0')
                return sizeB - sizeA
              })[0]
              
              if (bestIcon && bestIcon.src) {
                candidateLogo = resolveUrl(bestIcon.src, url)
              }
            }
          }
        } catch {
          // ignore manifest fetch errors
        }
      }

      // If no manifest logo, check HTML tags
      if (!candidateLogo) {
        for (const selector of iconSelectors) {
          const href = $(selector).attr('href')
          if (href) {
            candidateLogo = resolveUrl(href, url)
            break // Priority order gives us the best one first
          }
        }
      }

      // 3. Fallback to default favicon.ico if nothing is found
      if (!candidateLogo) {
        const defaultFavicon = resolveUrl('/favicon.ico', url)
        if (await validateImageUrl(defaultFavicon)) {
           candidateLogo = defaultFavicon
        }
      }

      // 4. Validate the chosen logo
      if (candidateLogo) {
        const isValid = await validateImageUrl(candidateLogo)
        if (isValid) {
          logoUrl = candidateLogo
          logoSource = 'detected'
        }
      }
    }
  } catch (e) {
    // Ignore fetch errors, fallback below
  }

  if (!logoUrl) {
    logoUrl = avatarFallback
    logoSource = 'fallback'
  }

  // Capitalize fallback name if it's still a domain name
  if (websiteName === cleanDomain) {
    const nameFallback = cleanDomain.split('.')[0]
    websiteName = nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1)
  }

  return NextResponse.json({
    websiteUrl: urlStr,
    domain: cleanDomain,
    websiteName: websiteName,
    logoUrl: logoUrl,
    logoSource: logoSource
  })
}
