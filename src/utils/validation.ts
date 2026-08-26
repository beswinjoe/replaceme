export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,15}$/

export const RESERVED_ROUTES = [
  'api',
  'auth',
  'checkout',
  'history',
  'leaderboard',
  'login',
  'notifications',
  'profile',
  'settings',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '_next'
]

export function isValidUsername(username: string): boolean {
  if (!username) return false
  if (!USERNAME_REGEX.test(username)) return false
  if (RESERVED_ROUTES.includes(username.toLowerCase())) return false
  return true
}
