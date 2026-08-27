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

// Check reachability and verify it's an image
async function checkReachability(url: string, isOgImage: boolean): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    // We use GET because some servers don't return content-length on HEAD
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    clearTimeout(timeout)
    
    if (res.ok) {
       const ct = res.headers.get('content-type')
       if (ct && ct.includes('text/html')) return false
       
       // Check for known Next.js/Vercel default logos by exact size signature
       // The Vercel triangle (icon.tsx) is exactly 513 bytes
       // The Vercel favicon.ico is exactly 25931 bytes
       if (!isOgImage) {
         try {
           const buffer = await res.arrayBuffer()
           const size = buffer.byteLength
           if (size === 513 || size === 25931 || size === 0) {
             return false // Reject known platform defaults
           }
         } catch {
           // ignore buffer read errors
         }
       }
       
       return true
    }
  } catch {
    return false
  }
  return false
}

interface Candidate {
  url: string
  size: number
  isSvg: boolean
  isPlatformDefault: boolean
  isFaviconIco: boolean
  isOgImage: boolean
  score?: number
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
  let finalLogoUrl = ''
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
      
      // 1. Resolve Website Name strictly respecting metadata strength
      const ogSiteName = $('meta[property="og:site_name"]').attr('content')
      const appName = $('meta[name="application-name"]').attr('content')
      
      if (ogSiteName) {
        websiteName = ogSiteName.trim()
      } else if (appName) {
        websiteName = appName.trim()
      } else {
        // We only parse manifest for name if OG doesn't exist
        let manifestName = null
        const manifestHref = $('link[rel="manifest"]').attr('href')
        if (manifestHref) {
           try {
             const mRes = await fetch(resolveUrl(manifestHref, url))
             if (mRes.ok) {
               const mJson = await mRes.json()
               manifestName = mJson.name || mJson.short_name
             }
           } catch { /* ignore */ }
        }
        
        if (manifestName) {
          websiteName = manifestName.trim()
        } else {
          // Last resort: Title
          const title = $('title').text()
          if (title) {
            // We ONLY use title as is, if we split, we might break things like "John Doe — AI Engineer"
            // We just use it, or fallback to domain.
            websiteName = title.trim()
          }
        }
      }

      // 2. Resolve Logo Candidates
      const candidates: Candidate[] = []
      const seenUrls = new Set<string>()

      const addCandidate = (href: string, type: string = '', sizes: string = '', isOg: boolean = false) => {
        if (!href) return
        const fullUrl = resolveUrl(href, url)
        if (seenUrls.has(fullUrl)) return
        seenUrls.add(fullUrl)
        
        let sizeScore = 0
        if (sizes && sizes.includes('x')) {
          sizeScore = parseInt(sizes.split('x')[0], 10) || 0
        }

        // Strict default heuristics (regardless of domain)
        const isNextJsDefault = fullUrl.includes('favicon.ico?favicon.')
        const isVercelTriangle = fullUrl.endsWith('vercel.svg')
        const isGenericPlatform = isPlatformDomain && fullUrl.includes(cleanDomain.split('.')[1] || 'default')

        candidates.push({
          url: fullUrl,
          size: sizeScore,
          isSvg: type === 'image/svg+xml' || fullUrl.endsWith('.svg'),
          isFaviconIco: fullUrl.endsWith('/favicon.ico') || isNextJsDefault,
          isPlatformDefault: isNextJsDefault || isVercelTriangle || isGenericPlatform,
          isOgImage: isOg
        })
      }

      // Read Manifest Icons
      const manifestHref = $('link[rel="manifest"]').attr('href')
      if (manifestHref) {
        try {
          const mRes = await fetch(resolveUrl(manifestHref, url))
          if (mRes.ok) {
            const mJson = await mRes.json()
            if (mJson.icons && Array.isArray(mJson.icons)) {
              mJson.icons.forEach((icon: any) => addCandidate(icon.src, icon.type, icon.sizes))
            }
          }
        } catch { /* ignore */ }
      }

      // Read HTML Icons
      $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
        addCandidate($(el).attr('href') || '', $(el).attr('type') || '', $(el).attr('sizes') || '')
      })

      // Read Open Graph and Twitter Images
      const ogImage = $('meta[property="og:image"]').attr('content')
      if (ogImage) addCandidate(ogImage, '', '', true)

      const twitterImage = $('meta[name="twitter:image"]').attr('content')
      if (twitterImage) addCandidate(twitterImage, '', '', true)

      // Add default favicon
      addCandidate('/favicon.ico')

      // 3. Score and Filter Candidates
      for (const cand of candidates) {
        cand.score = 0
        
        // Penetrate platform defaults heavily to force fallbacks
        if (cand.isPlatformDefault) {
          cand.score -= 2000
        }

        // Base scores based on size
        if (cand.size >= 512) cand.score += 500
        else if (cand.size >= 192) cand.score += 400
        else if (cand.size >= 128) cand.score += 300
        else if (cand.size >= 64) cand.score += 200
        else if (cand.size > 0) cand.score += 100
        else cand.score += 50 // valid icon but unknown size
        
        // High-res SVG is great, but tiny SVG isn't necessarily better than big PNG
        if (cand.isSvg && !cand.isPlatformDefault) cand.score += 350
        
        if (cand.isFaviconIco && !cand.isPlatformDefault) cand.score += 10 // Last resort for favicons

        // OpenGraph images are wide, so we don't want them overriding real icons.
        // But they are much better than falling back to initials.
        if (cand.isOgImage) {
          cand.score -= 50 // Slight penalty so icons win, but still higher than -1000
        }
      }

      // Sort by score descending
      candidates.sort((a, b) => (b.score || 0) - (a.score || 0))

      console.log('--- CANDIDATES FOR', urlStr, '---')
      candidates.forEach(c => console.log(c.url, 'score:', c.score, 'isPlatform:', c.isPlatformDefault))
      console.log('---------------------------')

      // 4. Test Reachability Sequentially
      for (const cand of candidates) {
        if (await checkReachability(cand.url, cand.isOgImage)) {
          // If it's a known platform default (e.g. Next.js generic favicon), fallback instead
          if (cand.isPlatformDefault && cand.score! < -1000) {
            break // go to fallback
          }
          finalLogoUrl = cand.url
          logoSource = 'detected'
          break
        }
      }
    }
  } catch (e) {
    // Ignore fetch errors, fallback below
  }

  // 5. Fallback logic
  if (!finalLogoUrl) {
    finalLogoUrl = avatarFallback
    logoSource = 'fallback'
  }

  // Capitalize fallback name if it's still a domain name
  if (websiteName === cleanDomain) {
    const nameParts = cleanDomain.split('.')
    const nameFallback = nameParts[0] || cleanDomain
    websiteName = nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1)
  }

  return NextResponse.json({
    websiteUrl: urlStr,
    domain: cleanDomain,
    websiteName: websiteName,
    logoUrl: finalLogoUrl,
    logoSource: logoSource
  })
}
