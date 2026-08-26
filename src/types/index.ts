export interface User {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  website_url: string | null
  created_at: string
}

export interface CurrentHolder {
  id: string
  user_id: string
  current_price: number
  replaced_at: string
  custom_message: string | null
  website_url: string | null
  created_at: string
  // Joined fields
  users?: User
}

export interface Replacement {
  id: string
  previous_user_id: string | null
  new_user_id: string
  amount_paid: number
  price_before: number
  price_after: number
  previous_holder_duration: number | null
  custom_message: string | null
  website_url: string | null
  created_at: string
  // Joined fields
  previous_user?: User
  new_user?: User
}

export interface Payment {
  id: string
  user_id: string
  dodo_payment_id: string
  amount: number
  status: 'pending' | 'succeeded' | 'failed'
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

export interface UserAchievement {
  user_id: string
  achievement_id: string
  earned_at: string
  achievements?: Achievement
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  action_url: string | null
  read: boolean
  created_at: string
}

export interface ProfileWithStats extends User {
  times_held_number_one: number
  total_spent: number
  longest_reign_seconds: number
  times_replaced: number
  biggest_replacement_value: number
  achievements: Achievement[]
  history: Replacement[]
}
