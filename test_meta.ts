import * as cheerio from 'cheerio'

async function checkReachability(url: string): Promise<boolean> {
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
       if (ct && ct.includes('text/html')) return false
       return true
    }
  } catch (e) {
    console.error("Reachability error:", e)
    return false
  }
  return false
}

async function main() {
    const url = "https://beswinjoe.me/opengraph-image?a92e4320e384220d"
    const r = await checkReachability(url)
    console.log("Reachability:", r)
    const res = await fetch(url, { method: 'HEAD' })
    console.log(res.headers.get('content-type'))
}

main()
