import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

const KNOWN_DEFAULT_HASHES: Set<string> = new Set([])

const PLATFORM_DOMAINS = [
  'vercel.app', 'netlify.app', 'herokuapp.com', 'onrender.com', 'pages.dev',
  'github.io', 'firebaseapp.com', 'web.app'
]

const NEXTJS_DEFAULT_ICON_PATTERNS = [
  /\/favicon\.ico\?favicon\./,
  /\/icon\?[a-f0-9]{16}$/
]

const PLATFORM_DEFAULT_URLS = [
  'vercel.svg', 'next.svg', 'netlify-logo.svg'
]

function resolveUrl(relativeUrl: string, baseUrl: URL): string {
  try {
    if (relativeUrl.startsWith('//')) return `https:${relativeUrl}`
    return new URL(relativeUrl, baseUrl).toString()
  } catch {
    return relativeUrl
  }
}

function isLikelyNextJsDefaultIcon(url: string): boolean {
  return NEXTJS_DEFAULT_ICON_PATTERNS.some(p => p.test(url))
}

function isPlatformDefaultUrl(url: string): boolean {
  return PLATFORM_DEFAULT_URLS.some(p => url.endsWith(p))
}

async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function validateCandidate(url: string): Promise<{ ok: boolean, hash: string | null, contentType: string | null, size: number }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeout)
    if (!res.ok) return { ok: false, hash: null, contentType: null, size: 0 }
    
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('text/html')) return { ok: false, hash: null, contentType: ct, size: 0 }
    
    const isImage = ct.includes('image/') || ct.includes('application/octet-stream') || !ct
    if (!isImage && ct) return { ok: false, hash: null, contentType: ct, size: 0 }
    
    const buffer = await res.arrayBuffer()
    const size = buffer.byteLength
    if (size === 0) return { ok: false, hash: null, contentType: ct, size: 0 }
    
    const hash = await computeHash(buffer)
    if (KNOWN_DEFAULT_HASHES.has(hash)) return { ok: false, hash, contentType: ct, size }
    return { ok: true, hash, contentType: ct, size }
  } catch {
    return { ok: false, hash: null, contentType: null, size: 0 }
  }
}

interface Candidate {
  url: string; declaredSize: number; isSvg: boolean; isPlatformDefault: boolean;
  isNextJsGenerated: boolean; isFaviconIco: boolean; isOgImage: boolean;
  isAppleTouchIcon: boolean; isManifestIcon: boolean; score?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  let urlParam = searchParams.get('url')?.trim()

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  // 1. Normalize Input Automatically
  if (!/^https?:\/\//i.test(urlParam)) {
    urlParam = `https://${urlParam}`
  }

  let url: URL
  try {
    url = new URL(urlParam)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const cleanDomain = url.hostname.replace(/^www\./, '')
  const isPlatformDomain = PLATFORM_DOMAINS.some(d => cleanDomain.endsWith(d))
  const avatarFallback = `/api/avatar/${encodeURIComponent(cleanDomain)}`

  // --- PLATFORM SPECIFIC EARLY RETURNS & VALIDATIONS ---

  // Discord Invites
  if (cleanDomain === 'discord.gg' || cleanDomain === 'discord.com') {
    const inviteMatch = url.pathname.match(/\/(?:invite\/)?([a-zA-Z0-9-]+)/)
    if (inviteMatch) {
      try {
        const res = await fetch(`https://discord.com/api/v9/invites/${inviteMatch[1]}`)
        if (!res.ok) throw new Error('Invalid Invite')
        const data = await res.json()
        return NextResponse.json({
          websiteUrl: urlParam,
          domain: 'discord.gg',
          websiteName: data.guild?.name || 'Discord Server',
          logoUrl: data.guild?.icon ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png` : avatarFallback,
          logoSource: data.guild?.icon ? 'detected' : 'fallback'
        })
      } catch (e) {
        return NextResponse.json({ error: 'Invalid Discord Invite' }, { status: 400 })
      }
    }
  }

  let websiteName = cleanDomain
  let finalLogoUrl = ''
  let logoSource = 'fallback'
  let knownNextJsHash: string | null = null
  let html = ''
  let status = 0

  // 2. Fetch and Verify Existence
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)
    
    // We send a generic user agent that looks like a real browser to avoid instant blocks from some sites
    const res = await fetch(url.toString(), {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    
    clearTimeout(timeoutId)
    status = res.status
    
    // Platform-specific 404 strict rejections
    const strict404Domains = ['github.com', 'youtube.com', 'tiktok.com', 'instagram.com', 'linkedin.com']
    if (strict404Domains.some(d => cleanDomain.endsWith(d)) && status === 404) {
      throw new Error('Social profile not found')
    }

    // General 404 strict rejection for all normal sites
    if (status === 404) {
      throw new Error('Website not found (404)')
    }

    try {
      html = await res.text()
    } catch { html = '' }

    // X / Twitter specific check (they return 404 sometimes, but also 200 with "User Profile Not Found")
    if (cleanDomain === 'x.com' || cleanDomain === 'twitter.com') {
      if (status === 404 || html.includes('<title>User Profile Not Found') || html.includes('Account suspended')) {
        throw new Error('X account not found')
      }
    }
    
    // If we get here, it's either a 200 OK, a 403 (Cloudflare), 999 (LinkedIn bot block)
    // We consider it VALID because the domain resolved and responded.
    
  } catch (e) {
    console.error(`Metadata fetch error for ${cleanDomain}:`, e)
    return NextResponse.json({ error: 'Unreachable website or invalid profile' }, { status: 400 })
  }

  // --- 3. Extract Metadata ---
  if (html) {
    const $ = cheerio.load(html)
    
    const ogSiteName = $('meta[property="og:site_name"]').attr('content')
    const ogTitle = $('meta[property="og:title"]').attr('content')
    const appName = $('meta[name="application-name"]').attr('content')
    
    if (ogTitle && (cleanDomain.includes('x.com') || cleanDomain.includes('twitter.com') || cleanDomain.includes('youtube.com') || cleanDomain.includes('github.com'))) {
      websiteName = ogTitle.trim() // X and YouTube put full name in og:title
    } else if (ogSiteName) {
      websiteName = ogSiteName.trim()
    } else if (appName) {
      websiteName = appName.trim()
    } else {
      const title = $('title').text()
      if (title) websiteName = title.trim()
    }

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
        url: fullUrl, declaredSize: sizeScore,
        isSvg: (opts.type === 'image/svg+xml') || fullUrl.endsWith('.svg'),
        isFaviconIco: fullUrl.endsWith('/favicon.ico') || /\/favicon\.ico\?/.test(fullUrl),
        isPlatformDefault: isPlatformUrl || (isPlatformDomain && isNextJs),
        isNextJsGenerated: isNextJs, isOgImage: opts.isOg || false,
        isAppleTouchIcon: opts.isAppleTouch || false, isManifestIcon: opts.isManifest || false,
      })
    }

    const manifestHref = $('link[rel="manifest"]').attr('href')
    if (manifestHref) {
      try {
        const mRes = await fetch(resolveUrl(manifestHref, url), { signal: AbortSignal.timeout(2000) })
        if (mRes.ok) {
          const mJson = await mRes.json()
          if (mJson.icons && Array.isArray(mJson.icons)) {
            mJson.icons.forEach((icon: any) => addCandidate(icon.src, { type: icon.type, sizes: icon.sizes, isManifest: true }))
          }
        }
      } catch { /* ignore */ }
    }

    $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => addCandidate($(el).attr('href') || '', { type: $(el).attr('type') || '', sizes: $(el).attr('sizes') || '', isAppleTouch: true }))
    $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => addCandidate($(el).attr('href') || '', { type: $(el).attr('type') || '', sizes: $(el).attr('sizes') || '' }))
    
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage) addCandidate(ogImage, { isOg: true })
    const twitterImage = $('meta[name="twitter:image"]').attr('content')
    if (twitterImage) addCandidate(twitterImage, { isOg: true })

    addCandidate('/favicon.ico')

    for (const cand of candidates) {
      let score = 0
      if (cand.isPlatformDefault) score -= 2000
      
      // Give massive boost to OG image for social profiles because it's usually their avatar
      if (cand.isOgImage && (cleanDomain.includes('x.com') || cleanDomain.includes('twitter.com') || cleanDomain.includes('github.com') || cleanDomain.includes('youtube.com') || cleanDomain.includes('instagram.com'))) {
        score += 1000
      }

      if (cand.declaredSize >= 512) score += 500
      else if (cand.declaredSize >= 192) score += 400
      else if (cand.declaredSize >= 128) score += 300
      else if (cand.declaredSize >= 64) score += 200
      else if (cand.declaredSize > 0) score += 100
      else score += 50

      if (cand.isSvg && !cand.isPlatformDefault) score += 350
      if (cand.isAppleTouchIcon) score += 80
      if (cand.isManifestIcon) score += 60
      if (cand.isFaviconIco) score -= 20
      if (cand.isNextJsGenerated) score -= 500
      // Normal OG images (non-social) get penalized as banners
      if (cand.isOgImage && score < 1000) score -= 200

      cand.score = score
    }

    candidates.sort((a, b) => (b.score || 0) - (a.score || 0))

    for (const cand of candidates) {
      if ((cand.score ?? 0) < -1000) continue
      const validation = await validateCandidate(cand.url)
      if (!validation.ok) continue

      if (cand.isNextJsGenerated) {
        if (knownNextJsHash === null && validation.hash) knownNextJsHash = validation.hash
        continue
      }
      if (knownNextJsHash && validation.hash === knownNextJsHash) continue

      finalLogoUrl = cand.url
      logoSource = 'detected'
      break
    }
  }

  if (!finalLogoUrl) {
    finalLogoUrl = avatarFallback
    logoSource = 'fallback'
  }

  if (websiteName === cleanDomain) {
    const nameParts = cleanDomain.split('.')
    const nameFallback = nameParts[0] || cleanDomain
    websiteName = nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1)
  }

  return NextResponse.json({
    websiteUrl: urlParam,
    domain: cleanDomain,
    websiteName: websiteName,
    logoUrl: finalLogoUrl,
    logoSource: logoSource
  })
}
