'use client'

import { useState } from 'react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-znk-csrf': '1' }
      })
    } finally {
      window.location.assign('/')
    }
  }

  return (
    <button
      type="button"
      className="nav-link nav-logout"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? 'DÉCONNEXION...' : 'DÉCONNEXION'}
    </button>
  )
}
