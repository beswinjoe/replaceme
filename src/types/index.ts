export interface CurrentHolder {
  id: string
  current_price: number
  replaced_at: string
  custom_message: string | null
  website_url: string
  website_name: string
  website_logo: string
  created_at: string
}

export interface Replacement {
  id: string
  previous_website_url: string | null
  previous_website_name: string | null
  previous_website_logo: string | null
  new_website_url: string
  new_website_name: string
  new_website_logo: string
  amount_paid: number
  price_before: number
  price_after: number
  previous_holder_duration: number | null
  custom_message: string | null
  created_at: string
}

export interface Payment {
  id: string
  website_url: string
  dodo_payment_id: string
  amount: number
  status: 'pending' | 'succeeded' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed'
  replacement_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
}

export interface WebsiteAchievement {
  website_url: string
  achievement_id: string
  earned_at: string
  achievements?: Achievement
}

export interface ProfileWithStats {
  website_url: string
  website_name: string
  website_logo: string
  times_held_number_one: number
  total_spent: number
  longest_reign_seconds: number
  times_replaced: number
  biggest_replacement_value: number
  achievements: Achievement[]
  history: Replacement[]
}
