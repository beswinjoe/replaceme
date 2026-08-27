import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing keys!")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const testWebsites = [
  { url: 'google.com', name: 'Google', logo: 'https://google.com/favicon.ico', msg: 'Search me' },
  { url: 'apple.com', name: 'Apple', logo: 'https://apple.com/favicon.ico', msg: 'Think different' },
  { url: 'microsoft.com', name: 'Microsoft', logo: 'https://microsoft.com/favicon.ico', msg: 'Windows' },
  { url: 'amazon.com', name: 'Amazon', logo: 'https://amazon.com/favicon.ico', msg: 'Buy stuff' },
  { url: 'netflix.com', name: 'Netflix', logo: 'https://netflix.com/favicon.ico', msg: 'Chill' },
  { url: 'meta.com', name: 'Meta', logo: 'https://meta.com/favicon.ico', msg: 'VR' },
  { url: 'tesla.com', name: 'Tesla', logo: 'https://tesla.com/favicon.ico', msg: 'Cars' },
  { url: 'spacex.com', name: 'SpaceX', logo: 'https://spacex.com/favicon.ico', msg: 'Mars' },
  { url: 'github.com', name: 'GitHub', logo: 'https://github.com/favicon.ico', msg: 'Code' },
  { url: 'vercel.com', name: 'Vercel', logo: 'https://vercel.com/favicon.ico', msg: 'Deploy' },
  { url: 'stripe.com', name: 'Stripe', logo: 'https://stripe.com/favicon.ico', msg: 'Payments' },
  { url: 'spotify.com', name: 'Spotify', logo: 'https://spotify.com/favicon.ico', msg: 'Music' },
  { url: 'airbnb.com', name: 'Airbnb', logo: 'https://airbnb.com/favicon.ico', msg: 'Travel' },
  { url: 'uber.com', name: 'Uber', logo: 'https://uber.com/favicon.ico', msg: 'Ride' },
  { url: 'discord.com', name: 'Discord', logo: 'https://discord.com/favicon.ico', msg: 'Chat' },
  { url: 'twitch.tv', name: 'Twitch', logo: 'https://twitch.tv/favicon.ico', msg: 'Stream' },
  { url: 'figma.com', name: 'Figma', logo: 'https://figma.com/favicon.ico', msg: 'Design' },
  { url: 'notion.so', name: 'Notion', logo: 'https://notion.so/favicon.ico', msg: 'Notes' },
  { url: 'openai.com', name: 'OpenAI', logo: 'https://openai.com/favicon.ico', msg: 'AI' },
  { url: 'anthropic.com', name: 'Anthropic', logo: 'https://anthropic.com/favicon.ico', msg: 'Claude' }
]

async function main() {
  console.log("Inserting 20 test websites...")
  
  const rows = testWebsites.map((site, i) => {
    // Generate random amounts. Let's make one really big one to test the stats
    let amount = Math.floor(Math.random() * 50) + 2; 
    if (i === 0) amount = 227000; // Big number for stats
    if (i === 1) amount = 5000;
    
    return {
      new_website_url: site.url,
      new_website_name: site.name,
      new_website_logo: site.logo,
      custom_message: site.msg,
      amount_paid: amount,
      price_before: 0,
      price_after: 0
    }
  })

  const { data, error } = await supabase.from('replacements').insert(rows).select()
  
  if (error) {
    console.error("Error inserting test data:", error)
  } else {
    console.log("Inserted", data.length, "rows successfully!")
  }
}

main()
