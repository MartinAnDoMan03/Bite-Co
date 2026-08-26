'use client'

import { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore'
import { safeToDate } from '../../lib/dateUtils'
import Link from "next/link";

// A "real" seller for stats purposes has to have an actual address on file —
// same fallback chain used on the Sellers page (address / outletAddress /
// pinAddress) — otherwise we're counting half-finished registrations that
// never completed onboarding as if they were real, addressable sellers.
const sellerHasAddress = (sellerData) => {
  const addr = sellerData.address || sellerData.outletAddress || sellerData.pinAddress
  return typeof addr === 'string' ? addr.trim().length > 0 : !!addr
}

const formatRelativeTime = (date) => {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
}

// Turn a raw order doc into a Recent Activity row, based on its real
// status/statusProgress — replaces the old hardcoded fake activity list.
const describeOrderActivity = (order) => {
  const date = safeToDate(order.createdAt) || new Date()
  const buyerName = order.buyerName || order.customerName || 'A buyer'
  const shortId = order.id ? `#${order.id.slice(-6)}` : ''

  let message = `New order ${shortId} placed by ${buyerName}`
  let status = 'pending'

  if (order.statusProgress === 'rejected') {
    message = `Order ${shortId} was rejected by the seller`
    status = 'error'
  } else if (order.status === 'failed' || order.statusProgress === 'cancelled') {
    message = `Order ${shortId} was cancelled`
    status = 'error'
  } else if (order.statusProgress === 'completed') {
    message = `Order ${shortId} completed successfully`
    status = 'success'
  } else if (order.statusProgress === 'delivery') {
    message = `Order ${shortId} is out for delivery`
    status = 'success'
  } else if (order.statusProgress === 'processing') {
    message = `Order ${shortId} payment confirmed, now processing`
    status = 'success'
  } else if (order.statusProgress === 'approved_awaiting_payment') {
    message = `Order ${shortId} approved by seller, awaiting payment`
    status = 'pending'
  } else if (order.statusProgress === 'awaiting_seller_approval' || order.statusProgress === 'waiting_approval') {
    message = `New order ${shortId} awaiting seller approval`
    status = 'pending'
  }

  return { id: order.id, message, time: formatRelativeTime(date), status }
}

export default function DashboardOverview() {
  // Raw docs from each collection — kept separate from `stats` so we can
  // recompute every derived number (growth %, conversion rate, etc.) in one
  // place whenever any of them changes, instead of each listener guessing at
  // numbers owned by another collection.
  const [rawSellers, setRawSellers] = useState([])
  const [rawBuyers, setRawBuyers] = useState([])
  const [rawOrders, setRawOrders] = useState([])

  const [stats, setStats] = useState({
    totalSellers: 0,
    activeSellers: 0,
    pendingApprovals: 0,
    totalBuyers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,   // order-count growth, last 30 days vs the 30 before that
    sellerGrowth: 0,
    buyerGrowth: 0,
    revenueGrowth: 0,
    conversionRate: 0,  // % of buyers who have placed at least one order
    weeklyOrders: [],
    recentActivity: []
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // --- Fetch raw data ---
  useEffect(() => {
    const unsubscribers = []

    try {
      const sellersUnsubscribe = onSnapshot(collection(db, 'sellers'),
        (snapshot) => {
          const sellersData = []
          snapshot.forEach((doc) => sellersData.push({ id: doc.id, ...doc.data() }))
          setRawSellers(sellersData)
        },
        (error) => {
          console.error('Error fetching sellers:', error)
          setError('Failed to load seller data')
        }
      )
      unsubscribers.push(sellersUnsubscribe)

      const buyersUnsubscribe = onSnapshot(collection(db, 'buyers'),
        (snapshot) => {
          const buyersData = []
          snapshot.forEach((doc) => buyersData.push({ id: doc.id, ...doc.data() }))
          setRawBuyers(buyersData)
        },
        (error) => {
          console.error('Error fetching buyers:', error)
          setError('Failed to load buyer data')
        }
      )
      unsubscribers.push(buyersUnsubscribe)

      // Remove orderBy to avoid issues if createdAt doesn't exist on all documents
      const ordersUnsubscribe = onSnapshot(collection(db, 'orders'),
        (snapshot) => {
          const ordersData = []
          snapshot.forEach((doc) => ordersData.push({ id: doc.id, ...doc.data() }))
          setRawOrders(ordersData)
        },
        (error) => {
          console.error('Error fetching orders:', error)
          setError('Failed to load order data')
        }
      )
      unsubscribers.push(ordersUnsubscribe)

      setError(null)
    } catch (error) {
      console.error('Error setting up real-time listeners:', error)
      setError('Failed to connect to database')
      setLoading(false)

      // Fallback to mock data so the layout still renders something sane
      // if Firestore itself is unreachable.
      setStats({
        totalSellers: 12,
        activeSellers: 10,
        pendingApprovals: 2,
        totalBuyers: 25,
        totalOrders: 48,
        totalRevenue: 1250000,
        monthlyGrowth: 15.3,
        sellerGrowth: 0,
        buyerGrowth: 0,
        revenueGrowth: 0,
        conversionRate: 0,
        weeklyOrders: [
          { day: 'Mon', orders: 5 },
          { day: 'Tue', orders: 8 },
          { day: 'Wed', orders: 6 },
          { day: 'Thu', orders: 10 },
          { day: 'Fri', orders: 12 },
          { day: 'Sat', orders: 15 },
          { day: 'Sun', orders: 9 }
        ],
        recentActivity: []
      })
    }

    return () => unsubscribers.forEach(unsubscribe => unsubscribe && unsubscribe())
  }, [])

  // --- Derive all display stats from the raw data ---
  useEffect(() => {
    const now = new Date()
    const last30 = new Date(now); last30.setDate(now.getDate() - 30)
    const prev30 = new Date(now); prev30.setDate(now.getDate() - 60)
    const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7)
    const getDate = (ts) => safeToDate(ts) || new Date(0)
    const growthPct = (recent, previous) => {
      if (previous > 0) return ((recent - previous) / previous) * 100
      return recent > 0 ? 100 : 0
    }

    // ---- Sellers: only ones with a real address count as real sellers ----
    const sellersWithAddress = rawSellers.filter(sellerHasAddress)
    const totalSellers = sellersWithAddress.length
    const activeSellers = sellersWithAddress.filter(s => s.status === 'approved').length
    const pendingApprovals = sellersWithAddress.filter(s => s.status !== 'approved').length
    const sellersLast30 = sellersWithAddress.filter(s => getDate(s.createdAt) >= last30).length
    const sellersPrev30 = sellersWithAddress.filter(s => {
      const d = getDate(s.createdAt)
      return d >= prev30 && d < last30
    }).length
    const sellerGrowth = growthPct(sellersLast30, sellersPrev30)

    // ---- Buyers ----
    const totalBuyers = rawBuyers.length
    const buyersLast30 = rawBuyers.filter(b => getDate(b.createdAt) >= last30).length
    const buyersPrev30 = rawBuyers.filter(b => {
      const d = getDate(b.createdAt)
      return d >= prev30 && d < last30
    }).length
    const buyerGrowth = growthPct(buyersLast30, buyersPrev30)

    // ---- Orders, revenue, weekly chart, conversion ----
    let totalRevenue = 0
    let ordersLast30 = 0, ordersPrev30 = 0
    let revenueLast30 = 0, revenuePrev30 = 0
    const weeklyOrdersMap = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 }
    const buyerIdsWhoOrdered = new Set()

    rawOrders.forEach((order) => {
      if (order.status === 'success' && order.totalAmount) {
        totalRevenue += order.totalAmount
      }
      if (order.buyerId) buyerIdsWhoOrdered.add(order.buyerId)

      const orderDate = getDate(order.createdAt)
      if (orderDate >= oneWeekAgo) {
        const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'short' })
        if (weeklyOrdersMap[dayName] !== undefined) weeklyOrdersMap[dayName]++
      }
      if (orderDate >= last30) {
        ordersLast30++
        if (order.status === 'success') revenueLast30 += (order.totalAmount || 0)
      } else if (orderDate >= prev30 && orderDate < last30) {
        ordersPrev30++
        if (order.status === 'success') revenuePrev30 += (order.totalAmount || 0)
      }
    })

    const weeklyOrders = Object.entries(weeklyOrdersMap).map(([day, orders]) => ({ day, orders }))
    const monthlyGrowth = growthPct(ordersLast30, ordersPrev30)
    const revenueGrowth = growthPct(revenueLast30, revenuePrev30)
    const conversionRate = totalBuyers > 0 ? (buyerIdsWhoOrdered.size / totalBuyers) * 100 : 0

    const recentActivity = [...rawOrders]
      .sort((a, b) => getDate(b.createdAt) - getDate(a.createdAt))
      .slice(0, 5)
      .map(describeOrderActivity)

    setStats({
      totalSellers,
      activeSellers,
      pendingApprovals,
      totalBuyers,
      totalOrders: rawOrders.length,
      totalRevenue,
      monthlyGrowth: Number(monthlyGrowth.toFixed(1)),
      sellerGrowth: Number(sellerGrowth.toFixed(1)),
      buyerGrowth: Number(buyerGrowth.toFixed(1)),
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      conversionRate: Number(conversionRate.toFixed(1)),
      weeklyOrders,
      recentActivity
    })
    setLoading(false)
  }, [rawSellers, rawBuyers, rawOrders])

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
        {change !== undefined && change !== null && (
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

  const RecentActivity = ({ activities }) => (
    <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
        <Link href="/dashboard/orders" className="text-sm text-[#711330] hover:text-[#8b1538] font-medium">View All</Link>
      </div>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No recent activity yet.</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-xl hover:bg-slate-50 transition-colors duration-200">
              <div className={`w-3 h-3 rounded-full ${
                activity.status === 'success' ? 'bg-emerald-400' :
                activity.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'
              }`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{activity.message}</p>
                <p className="text-xs text-slate-500">{activity.time}</p>
              </div>
            </div>
          ))
        )}
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
          change={stats.sellerGrowth}
          changeType={stats.sellerGrowth >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          title="Active Sellers"
          value={stats.activeSellers.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          }
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
          change={stats.buyerGrowth}
          changeType={stats.buyerGrowth >= 0 ? 'positive' : 'negative'}
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
          change={stats.monthlyGrowth}
          changeType={stats.monthlyGrowth >= 0 ? 'positive' : 'negative'}
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
          change={stats.revenueGrowth}
          changeType={stats.revenueGrowth >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          title="Monthly Growth"
          value={`${stats.monthlyGrowth}%`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
          }
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/>
            </svg>
          }
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
        <RecentActivity activities={stats.recentActivity} />
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