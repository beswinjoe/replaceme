import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log("Fetching replacements...")
  const { data: replacements, error } = await supabase
    .from('replacements')
    .select('id, new_website_url, new_website_logo')

  if (error) {
    console.error("Error fetching replacements:", error)
    return
  }

  console.log(`Found ${replacements.length} replacements.`)

  for (const row of replacements) {
    const url = row.new_website_url
    const currentLogo = row.new_website_logo || ''

    // Re-resolve logo
    console.log(`\nResolving logo for: ${url}`)
    try {
      const res = await fetch(`http://localhost:3000/api/metadata?url=${encodeURIComponent(url)}`)
      if (!res.ok) {
        console.log(`Failed to resolve metadata for ${url}`)
        continue
      }
      
      const data = await res.json() as { logoUrl?: string }
      const newLogo = data.logoUrl

      if (newLogo && newLogo !== currentLogo) {
        console.log(`UPDATING LOGO FOR ${url}`)
        console.log(`Old: ${currentLogo}`)
        console.log(`New: ${newLogo}`)
        
        const { error: updateError } = await supabase
          .from('replacements')
          .update({ new_website_logo: newLogo })
          .eq('id', row.id)
          
        if (updateError) {
          console.error("Update error:", updateError)
        } else {
          console.log("Update successful!")
        }
      } else {
        console.log(`Logo unchanged or empty for ${url}`)
      }
    } catch (e) {
      console.error(`Fetch error for ${url}:`, e)
    }
  }
}

main()
