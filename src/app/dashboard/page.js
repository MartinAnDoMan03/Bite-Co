'use client'

import { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore'
import { safeToDate } from '../../lib/dateUtils'
import Link from "next/link";

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    totalSellers: 0,
    activeSellers: 0,
    pendingApprovals: 0,
    totalBuyers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,
    weeklyOrders: []
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribers = setupRealtimeData()
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe && unsubscribe())
    }
  }, [])

  const setupRealtimeData = () => {
    const unsubscribers = []

    try {
      // Listen to sellers collection
      const sellersRef = collection(db, 'sellers')
      const sellersUnsubscribe = onSnapshot(sellersRef, 
        (snapshot) => {
          let totalSellers = 0
          let activeSellers = 0
          let pendingApprovals = 0

          // console.log('Total documents in sellers collection:', snapshot.size)

          snapshot.forEach((doc) => {
            const sellerData = doc.data()
            // console.log('Seller data:', { id: doc.id, status: sellerData.status })
            
            totalSellers++
            if (sellerData.status === 'approved') {
              activeSellers++
            } else {
              pendingApprovals++
            }
          })

          setStats(prevStats => ({
            ...prevStats,
            totalSellers,
            activeSellers,
            pendingApprovals
          }))
        },
        (error) => {
          console.error('Error fetching sellers:', error)
          setError('Failed to load seller data')
        }
      )
      unsubscribers.push(sellersUnsubscribe)

      // Listen to buyers collection
      const buyersRef = collection(db, 'buyers')
      const buyersUnsubscribe = onSnapshot(buyersRef, 
        (snapshot) => {
          const totalBuyers = snapshot.size
          // console.log('Total documents in buyers collection:', totalBuyers)

          setStats(prevStats => ({
            ...prevStats,
            totalBuyers
          }))
        },
        (error) => {
          console.error('Error fetching buyers:', error)
          setError('Failed to load buyer data')
        }
      )
      unsubscribers.push(buyersUnsubscribe)

      // Listen to orders collection
      const ordersRef = collection(db, 'orders')
      // Remove orderBy to avoid issues if createdAt doesn't exist on all documents
      const ordersUnsubscribe = onSnapshot(ordersRef, 
        (snapshot) => {
          let totalOrders = 0
          let totalRevenue = 0
          const weeklyOrdersMap = {
            'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0
          }
          
          const oneWeekAgo = new Date()
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

          // console.log('Total documents in orders collection:', snapshot.size)

          snapshot.forEach((doc) => {
            const orderData = doc.data()
            // console.log('Order data:', { 
            //   id: doc.id, 
            //   status: orderData.status, 
            //   statusProgress: orderData.statusProgress, 
            //   totalAmount: orderData.totalAmount 
            // })
            
            totalOrders++
            
            // Only count revenue from successful orders
            if (orderData.status === 'success' && orderData.totalAmount) {
              totalRevenue += orderData.totalAmount
            }

            // Count weekly orders
            if (orderData.createdAt) {
              try {
                const orderDate = safeToDate(orderData.createdAt)
                if (orderDate && orderDate >= oneWeekAgo) {
                  const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'short' })
                  if (weeklyOrdersMap[dayName] !== undefined) {
                    weeklyOrdersMap[dayName]++
                  }
                }
              } catch (error) {
                console.warn('Error processing order date:', error)
              }
            }
          })

          const weeklyOrders = Object.entries(weeklyOrdersMap).map(([day, orders]) => ({ day, orders }))

          setStats(prevStats => ({
            ...prevStats,
            totalOrders,
            totalRevenue,
            monthlyGrowth: 15.3, // This would need historical data comparison
            weeklyOrders
          }))
        },
        (error) => {
          console.error('Error fetching orders:', error)
        }
      )
      unsubscribers.push(ordersUnsubscribe)

      setLoading(false)
      setError(null)

    } catch (error) {
      console.error('Error setting up real-time listeners:', error)
      setError('Failed to connect to database')
      setLoading(false)
      
      // Fallback to mock data
      setStats({
        totalSellers: 12,
        activeSellers: 10,
        pendingApprovals: 2,
        totalBuyers: 25,
        totalOrders: 48,
        totalRevenue: 1250000,
        monthlyGrowth: 15.3,
        weeklyOrders: [
          { day: 'Mon', orders: 5 },
          { day: 'Tue', orders: 8 },
          { day: 'Wed', orders: 6 },
          { day: 'Thu', orders: 10 },
          { day: 'Fri', orders: 12 },
          { day: 'Sat', orders: 15 },
          { day: 'Sun', orders: 9 }
        ]
      })
    }

    return unsubscribers
  }

  const StatCard = ({ title, value, icon, change, changeType }) => (
    <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-[#711330] to-[#8b1538] rounded-2xl shadow-lg">
            <div className="text-white">{icon}</div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        </div>
        {change && (
          <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${
            changeType === 'positive' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            <span className="text-xs">
              {changeType === 'positive' ? '↗' : '↘'}
            </span>
            <span>{change}%</span>
          </div>
        )}
      </div>
    </div>
  )

  const RecentActivity = () => (
    <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
        <button className="text-sm text-[#711330] hover:text-[#8b1538] font-medium">View All</button>
      </div>
      <div className="space-y-4">
        {[
          { type: 'seller_registered', message: 'New seller "Warung Bahari" registered', time: '2 hours ago', status: 'pending' },
          { type: 'order_completed', message: 'Order #5847 completed successfully', time: '3 hours ago', status: 'success' },
          { type: 'seller_approved', message: 'Seller "Kedai Nusantara" approved', time: '5 hours ago', status: 'success' },
          { type: 'payment_received', message: 'Payment of Rp 150,000 received', time: '8 hours ago', status: 'success' },
          { type: 'seller_rejected', message: 'Seller application rejected - incomplete documents', time: '1 day ago', status: 'error' }
        ].map((activity, index) => (
          <div key={index} className="flex items-center space-x-4 p-3 rounded-xl hover:bg-slate-50 transition-colors duration-200">
            <div className={`w-3 h-3 rounded-full ${
              activity.status === 'success' ? 'bg-emerald-400' :
              activity.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'
            }`}></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{activity.message}</p>
              <p className="text-xs text-slate-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#711330] mb-4"></div>
        <p className="text-gray-600">Loading dashboard data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Connection Error</h3>
        <p className="text-gray-500 text-center mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-[#711330] text-white rounded-md hover:bg-[#8b1538] transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#711330] via-[#8b1538] to-[#a51a42] rounded-3xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, Admin!</h1>
            <p className="text-white/80 text-lg">
              Here&apos;s what&apos;s happening with Bite&Co today.
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white/80">Live data</span>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-2xl font-bold">{new Date().toLocaleDateString()}</div>
              <div className="text-sm text-white/70">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sellers"
          value={stats.totalSellers.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
            </svg>
          }
          change={12.5}
          changeType="positive"
        />
        <StatCard
          title="Active Sellers"
          value={stats.activeSellers.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          }
          change={8.2}
          changeType="positive"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
          }
        />
        <StatCard
          title="Total Buyers"
          value={stats.totalBuyers.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/>
            </svg>
          }
          change={23.1}
          changeType="positive"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
            </svg>
          }
          change={18.7}
          changeType="positive"
        />
        <StatCard
          title="Total Revenue"
          value={`Rp ${(stats.totalRevenue / 1000000).toFixed(1)}M`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
            </svg>
          }
          change={stats.monthlyGrowth}
          changeType="positive"
        />
        <StatCard
          title="Monthly Growth"
          value={`${stats.monthlyGrowth}%`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
          }
          change={2.4}
          changeType="positive"
        />
        <StatCard
          title="Conversion Rate"
          value="24.8%"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/>
            </svg>
          }
          change={1.2}
          changeType="positive"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Orders Chart */}
        <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Weekly Orders</h3>
          <div className="space-y-4">
            {stats.weeklyOrders.map((day, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="w-12 text-sm font-medium text-slate-600">{day.day}</div>
                <div className="flex-1">
                  <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#711330] to-[#8b1538] h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(day.orders / 100) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-12 text-sm font-bold text-slate-900 text-right">{day.orders}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <RecentActivity />
      </div>

      {/* Quick Actions */}
      <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/dashboard/sellers" className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#711330] to-[#8b1538] text-white rounded-2xl hover:shadow-lg hover:shadow-[#711330]/25 transition-all duration-300 hover:scale-105">
            <svg className="w-8 h-8 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span className="text-sm font-medium">Approve Sellers</span>
          </Link>
          <Link href="/dashboard/analytics" className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 hover:scale-105">
            <svg className="w-8 h-8 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            <span className="text-sm font-medium">View Reports</span>
          </Link>
          <Link href="/dashboard/buyers" className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300 hover:scale-105">
            <svg className="w-8 h-8 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
            </svg>
            <span className="text-sm font-medium">Manage Users</span>
          </Link>
          <Link href="/dashboard/settings" className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-500 to-slate-700 text-white rounded-2xl hover:shadow-lg hover:shadow-slate-500/25 transition-all duration-300 hover:scale-105">
            <svg className="w-8 h-8 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
            </svg>
            <span className="text-sm font-medium">Settings</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
