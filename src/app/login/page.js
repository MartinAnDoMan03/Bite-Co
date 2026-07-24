'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminLogin } from '../../lib/auth'
import config from '../../config/config'

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    // No Firebase initialization needed for simple login
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password
      })
    })

    const result = await response.json()
      
      if (result.success) {
        // Save the logged-in admin so the dashboard's auth check (which reads
        // this localStorage key, not the cookie) recognizes the session.
        localStorage.setItem('bite-admin-user', JSON.stringify(result.user))

        // Redirect to dashboard
        router.push('/dashboard')
      } else {
        setError(result.error || 'Login failed. Please try again.')
      }
    } catch (error) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-br from-[#711330] to-[#8B1538] rounded-3xl flex items-center justify-center shadow-xl shadow-[#711330]/25">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-slate-900">
            Sign in to {config.appName} Admin
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Access your dashboard with your admin credentials
          </p>
          

        </div>

        {/* Login Form */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="block w-full px-4 py-3 bg-slate-50/70 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:bg-white focus:border-[#711330] focus:ring-2 focus:ring-[#711330]/20 transition-all duration-200"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full px-4 py-3 bg-slate-50/70 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:bg-white focus:border-[#711330] focus:ring-2 focus:ring-[#711330]/20 transition-all duration-200"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 bg-gradient-to-r from-[#711330] to-[#8B1538] text-white font-medium rounded-2xl hover:from-[#8B1538] hover:to-[#A91D4A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#711330] disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] shadow-lg hover:shadow-[#711330]/25"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in to Dashboard'
              )}
            </button>
          </form>


        </div>

        <p className="text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Bite&Co. All rights reserved.
        </p>
      </div>
    </div>
  )
}