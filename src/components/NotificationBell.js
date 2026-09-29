'use client'

import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'), limit(30))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsubscribe()
  }, [])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'adminNotifications', id), { isRead: true })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-gray-500 hover:text-[#711330] transition-colors"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="px-4 py-2 border-b border-gray-100 font-semibold text-sm text-gray-700">
            Notifications
          </div>
          {notifications.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">No notifications yet</div>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-[#faf5f6]' : ''}`}
            >
              <div className="text-sm font-medium text-gray-900">{n.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}