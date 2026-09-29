'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { adminLogout } from '../lib/auth'
import { setupAdminPushNotifications } from '../lib/adminPush'
import NotificationBell from './NotificationBell'

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Check if user is stored in localStorage
        const storedUser = localStorage.getItem('bite-admin-user')
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        } else {
          setUser(currentUser)
        }
        setLoading(false)
        setupAdminPushNotifications();
      } else {
        // No user is signed in, redirect to login
        router.push('/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleLogout = async () => {
    try {
      await adminLogout()
      localStorage.removeItem('bite-admin-user')
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#711330]"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-[#711330]">Bite&Co Admin</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <span className="text-sm text-gray-700">
                Welcome, {user.username || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-[#711330] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#8B1538] transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
