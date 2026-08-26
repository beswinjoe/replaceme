export function getClientId(): string {
  if (typeof window === 'undefined') return 'server'
  
  const STORE_KEY = 'rm_client_id'
  let clientId = localStorage.getItem(STORE_KEY)
  
  if (!clientId) {
    // Generate a simple UUID v4 equivalent for client identity
    clientId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem(STORE_KEY, clientId)
    
    // Also try to set it as a cookie for server-side link clicking if possible
    document.cookie = `${STORE_KEY}=${clientId}; path=/; max-age=31536000; SameSite=Lax`
  }
  
  return clientId
}
