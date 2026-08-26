import React from 'react'

interface InitialsAvatarProps {
  name: string
  className?: string
}

function getInitials(name: string): string {
  if (!name) return '?'
  const cleanName = name.replace(/^@/, '').trim()
  const parts = cleanName.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return cleanName.slice(0, 2).toUpperCase()
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    // Keep colors slightly muted/darker for white text contrast and premium feel
    const dimmed = Math.floor(value * 0.6)
    color += ('00' + dimmed.toString(16)).slice(-2)
  }
  return color
}

export function InitialsAvatar({ name, className = '' }: InitialsAvatarProps) {
  const initials = getInitials(name)
  const bgColor = stringToColor(name || 'user')

  return (
    <div 
      className={`flex items-center justify-center rounded-full text-white font-bold tracking-wider flex-shrink-0 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  )
}
