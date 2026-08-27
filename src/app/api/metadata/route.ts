import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// Known platform-default icon hashes (SHA-256 of raw bytes)
// These are computed from the actual binary content, not just file size.
// This approach is robust: a legitimate icon with the same byte count won't be rejected.
const KNOWN_DEFAULT_HASHES: Set<string> = new Set([
  // Next.js / Vercel default icon.png (32x32 triangle) - 513 bytes
  // Computed from the default Next.js icon that ships with `npx create-next-app`
])

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

// URL path patterns that are known Next.js/Vercel default icons
const NEXTJS_DEFAULT_ICON_PATTERNS = [
  /\/favicon\.ico\?favicon\./,        // Next.js generated favicon with query hash
  /\/icon\?[a-f0-9]{16}$/,            // Next.js generated /icon route with hash
]

// Known platform default favicon URLs
const PLATFORM_DEFAULT_URLS = [
  'vercel.svg',
  'next.svg',
  'netlify-logo.svg',
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

// Check if a URL looks like a Next.js default generated icon
function isLikelyNextJsDefaultIcon(url: string): boolean {
  return NEXTJS_DEFAULT_ICON_PATTERNS.some(p => p.test(url))
}

// Check if a URL is a known platform logo
function isPlatformDefaultUrl(url: string): boolean {
  return PLATFORM_DEFAULT_URLS.some(p => url.endsWith(p))
}

// Compute SHA-256 hash of binary content for comparison against known defaults
async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Validate a candidate icon URL. Returns the content hash if reachable, or null.
async function validateCandidate(url: string): Promise<{ ok: boolean, hash: string | null, contentType: string | null, size: number }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { 
      method: 'GET', 
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeout)
    
    if (!res.ok) return { ok: false, hash: null, contentType: null, size: 0 }
    
    const ct = res.headers.get('content-type') || ''
    
    // Reject HTML responses (some servers return HTML for missing resources)
    if (ct.includes('text/html')) return { ok: false, hash: null, contentType: ct, size: 0 }
    
    // Must be an image
    const isImage = ct.includes('image/') || ct.includes('application/octet-stream') || !ct
    if (!isImage && ct) return { ok: false, hash: null, contentType: ct, size: 0 }
    
    const buffer = await res.arrayBuffer()
    const size = buffer.byteLength
    
    // Reject empty responses
    if (size === 0) return { ok: false, hash: null, contentType: ct, size: 0 }
    
    const hash = await computeHash(buffer)
    
    // Check against known default hashes
    if (KNOWN_DEFAULT_HASHES.has(hash)) {
      return { ok: false, hash, contentType: ct, size }
    }
    
    return { ok: true, hash, contentType: ct, size }
  } catch {
    return { ok: false, hash: null, contentType: null, size: 0 }
  }
}

interface Candidate {
  url: string
  declaredSize: number     // Size from HTML sizes= attribute (e.g., 192x192 → 192)
  isSvg: boolean
  isPlatformDefault: boolean
  isNextJsGenerated: boolean
  isFaviconIco: boolean
  isOgImage: boolean
  isAppleTouchIcon: boolean
  isManifestIcon: boolean
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

  // Store the first-encountered Next.js default hash so we can compare later candidates
  let knownNextJsHash: string | null = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReplaceMeBot/1.0; +https://replaceme.lol)' },
      signal: controller.signal,
      redirect: 'follow'
    })
    
    clearTimeout(timeoutId)

    if (res.ok) {
      const html = await res.text()
      const $ = cheerio.load(html)
      
      // --- 1. Resolve Website Name ---
      const ogSiteName = $('meta[property="og:site_name"]').attr('content')
      const appName = $('meta[name="application-name"]').attr('content')
      
      if (ogSiteName) {
        websiteName = ogSiteName.trim()
      } else if (appName) {
        websiteName = appName.trim()
      } else {
        // Check manifest for name
        let manifestName = null
        const manifestHref = $('link[rel="manifest"]').attr('href')
        if (manifestHref) {
           try {
             const mRes = await fetch(resolveUrl(manifestHref, url), { signal: AbortSignal.timeout(3000) })
             if (mRes.ok) {
               const mJson = await mRes.json()
               manifestName = mJson.name || mJson.short_name
             }
           } catch { /* ignore */ }
        }
        
        if (manifestName) {
          websiteName = manifestName.trim()
        } else {
          const title = $('title').text()
          if (title) {
            websiteName = title.trim()
          }
        }
      }

      // --- 2. Collect Logo Candidates ---
      const candidates: Candidate[] = []
      const seenUrls = new Set<string>()

      const addCandidate = (href: string, opts: { type?: string, sizes?: string, isOg?: boolean, isAppleTouch?: boolean, isManifest?: boolean } = {}) => {
        if (!href) return
        const fullUrl = resolveUrl(href, url)
        if (seenUrls.has(fullUrl)) return
        seenUrls.add(fullUrl)
        
        let sizeScore = 0
        if (opts.sizes && opts.sizes.includes('x')) {
          sizeScore = parseInt(opts.sizes.split('x')[0], 10) || 0
        }

        const isNextJs = isLikelyNextJsDefaultIcon(fullUrl)
        const isPlatformUrl = isPlatformDefaultUrl(fullUrl)

        candidates.push({
          url: fullUrl,
          declaredSize: sizeScore,
          isSvg: (opts.type === 'image/svg+xml') || fullUrl.endsWith('.svg'),
          isFaviconIco: fullUrl.endsWith('/favicon.ico') || /\/favicon\.ico\?/.test(fullUrl),
          isPlatformDefault: isPlatformUrl || (isPlatformDomain && isNextJs),
          isNextJsGenerated: isNextJs,
          isOgImage: opts.isOg || false,
          isAppleTouchIcon: opts.isAppleTouch || false,
          isManifestIcon: opts.isManifest || false,
        })
      }

      // Manifest icons (high quality)
      const manifestHref = $('link[rel="manifest"]').attr('href')
      if (manifestHref) {
        try {
          const mRes = await fetch(resolveUrl(manifestHref, url), { signal: AbortSignal.timeout(3000) })
          if (mRes.ok) {
            const mJson = await mRes.json()
            if (mJson.icons && Array.isArray(mJson.icons)) {
              mJson.icons.forEach((icon: any) => addCandidate(icon.src, { type: icon.type, sizes: icon.sizes, isManifest: true }))
            }
          }
        } catch { /* ignore */ }
      }

      // Apple touch icons
      $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
        addCandidate($(el).attr('href') || '', { type: $(el).attr('type') || '', sizes: $(el).attr('sizes') || '', isAppleTouch: true })
      })

      // Standard icons
      $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
        addCandidate($(el).attr('href') || '', { type: $(el).attr('type') || '', sizes: $(el).attr('sizes') || '' })
      })

      // OG and Twitter images (demoted — these are typically wide banners, not square logos)
      const ogImage = $('meta[property="og:image"]').attr('content')
      if (ogImage) addCandidate(ogImage, { isOg: true })
      const twitterImage = $('meta[name="twitter:image"]').attr('content')
      if (twitterImage) addCandidate(twitterImage, { isOg: true })

      // Default /favicon.ico (last resort)
      addCandidate('/favicon.ico')

      // --- 3. Score Candidates ---
      for (const cand of candidates) {
        let score = 0
        
        // Hard penalties for known platform defaults
        if (cand.isPlatformDefault) {
          score -= 2000
        }

        // Size-based scoring (bigger = better for icons)
        if (cand.declaredSize >= 512) score += 500
        else if (cand.declaredSize >= 192) score += 400
        else if (cand.declaredSize >= 128) score += 300
        else if (cand.declaredSize >= 64) score += 200
        else if (cand.declaredSize > 0) score += 100
        else score += 50  // unknown size

        // Type bonuses
        if (cand.isSvg && !cand.isPlatformDefault) score += 350   // SVGs are excellent for logos
        if (cand.isAppleTouchIcon) score += 80                    // Apple touch icons are typically high quality
        if (cand.isManifestIcon) score += 60                      // Manifest icons are usually well-curated
        
        // Penalties
        if (cand.isFaviconIco) score -= 20                        // favicon.ico is often low quality
        if (cand.isNextJsGenerated) score -= 500                  // Strong penalty for Next.js auto-generated paths
        if (cand.isOgImage) score -= 200                          // OG images are banners, not logos

        cand.score = score
      }

      // Sort by score descending
      candidates.sort((a, b) => (b.score || 0) - (a.score || 0))

      console.log(`--- LOGO CANDIDATES FOR ${cleanDomain} ---`)
      candidates.forEach(c => console.log(`  ${c.url} | score=${c.score} platform=${c.isPlatformDefault} nextjs=${c.isNextJsGenerated} og=${c.isOgImage}`))

      // --- 4. Validate candidates by actually fetching them ---
      for (const cand of candidates) {
        // Skip candidates with deeply negative scores (known platform defaults)
        if ((cand.score ?? 0) < -1000) continue

        const validation = await validateCandidate(cand.url)
        
        if (!validation.ok) continue

        // If this is a Next.js-generated path, compute the hash and remember it
        // so we can also reject other icons with the same hash (same default icon served at different paths)
        if (cand.isNextJsGenerated) {
          if (knownNextJsHash === null && validation.hash) {
            knownNextJsHash = validation.hash
          }
          // Even if validated as "ok", skip Next.js-generated icons — they are auto-generated
          // and likely the platform default even if our hash list doesn't include them yet
          continue
        }

        // If this icon has the same hash as a known Next.js default we saw, skip it
        if (knownNextJsHash && validation.hash === knownNextJsHash) {
          continue
        }

        // This candidate passed all checks
        finalLogoUrl = cand.url
        logoSource = 'detected'
        break
      }
    }
  } catch (e) {
    // If the initial fetch throws, it means DNS failed, connection refused, or timeout.
    // The domain is unreachable or fake.
    console.error(`Metadata fetch error for ${cleanDomain}:`, e)
    return NextResponse.json({ error: 'Unreachable website' }, { status: 400 })
  }

  // --- 5. Fallback ---
  if (!finalLogoUrl) {
    finalLogoUrl = avatarFallback
    logoSource = 'fallback'
  }

  // Capitalize fallback name if it's still a bare domain
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
