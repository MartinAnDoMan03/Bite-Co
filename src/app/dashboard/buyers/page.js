'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { db } from '../../../lib/firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import { safeToDateString } from '../../../lib/dateUtils'

export default function BuyersPage() {
  const [rawBuyers, setRawBuyers] = useState([])
  const [orders, setOrders] = useState([])
  const [loadingBuyers, setLoadingBuyers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('joinDate') // joinDate, totalOrders, totalSpent
  const [error, setError] = useState(null)

  const loading = loadingBuyers || loadingOrders

  useEffect(() => {
    const setupRealtimeBuyers = () => {
      try {
        // Query the 'buyers' collection
        const buyersRef = collection(db, 'buyers')
        const unsubscribe = onSnapshot(buyersRef, 
          (snapshot) => {
            const buyersData = []
            // console.log('Total documents in buyers collection:', snapshot.size)
            
            snapshot.forEach((doc) => {
              const buyerData = doc.data()
              // console.log('Buyer data:', { id: doc.id, name: buyerData.name, email: buyerData.email })
              
              buyersData.push({
                id: doc.id,
                name: buyerData.name || buyerData.displayName || 'Unknown User',
                email: buyerData.email || '',
                phone: buyerData.phone || buyerData.phoneNumber || '',
                joinDate: safeToDateString(buyerData.createdAt),
                favoriteCategories: buyerData.favoriteCategories || [],
                location: buyerData.address?.city || buyerData.location || 'Unknown',
                status: buyerData.isActive !== false ? 'active' : 'inactive',
                emailValidated: buyerData.emailValidated || false,
                phoneValidated: buyerData.phoneValidated || false,
                profileImage: buyerData.profileImage || null
              })
            })
            
            // console.log('Found buyers:', buyersData.length)
            setRawBuyers(buyersData)
            setLoadingBuyers(false)
            setError(null)
          },
          (error) => {
            console.error('Error fetching buyers:', error)
            setError('Failed to load buyers data')
            setLoadingBuyers(false)
            setRawBuyers([])
          }
        )
        
        return unsubscribe
      } catch (error) {
        console.error('Error setting up buyers listener:', error)
        setError('Failed to connect to database')
        setLoadingBuyers(false)
        return null
      }
    }

    const unsubscribe = setupRealtimeBuyers()
    return () => unsubscribe && unsubscribe()
  }, [])

  useEffect(() => {
    const setupRealtimeOrders = () => {
      try {
        const ordersRef = collection(db, 'orders')
        const unsubscribe = onSnapshot(ordersRef,
          (snapshot) => {
            const ordersData = []
            snapshot.forEach((doc) => {
              const orderData = doc.data()
              ordersData.push({
                id: doc.id,
                buyerId: orderData.buyerId || null,
                totalAmount: orderData.totalAmount || 0,
                statusProgress: orderData.statusProgress || orderData.status || null,
                createdAt: orderData.createdAt || null,
              })
            })
            setOrders(ordersData)
            setLoadingOrders(false)
          },
          (error) => {
            console.error('Error fetching orders:', error)
            setOrders([])
           setLoadingOrders(false)
          }
        )
        return unsubscribe
      } catch (error) {
        console.error('Error setting up orders listener:', error)
        setLoadingOrders(false)
        return null
      }
    }

    const unsubscribe = setupRealtimeOrders()
    return () => unsubscribe && unsubscribe()
  }, [])


  const ordersByBuyerId = {}
  orders.forEach((order) => {
    if (!order.buyerId) return
    if (!ordersByBuyerId[order.buyerId]) ordersByBuyerId[order.buyerId] = []
    ordersByBuyerId[order.buyerId].push(order)
  })

  const buyers = rawBuyers.map((buyer) => {
    const buyerOrders = ordersByBuyerId[buyer.id] || []
    const completedOrders = buyerOrders.filter((o) => o.statusProgress === 'completed')
    const totalSpent = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    const lastOrder = buyerOrders.reduce((latest, o) => {
      if (!o.createdAt) return latest
      const d = new Date(o.createdAt)
      return !latest || d > latest ? d : latest
    }, null)

    return {
      ...buyer,
      totalOrders: buyerOrders.length,
      totalSpent,
      lastOrderDate: lastOrder ? safeToDateString(lastOrder.toISOString()) : null,
    }
  })

  // Sort buyers based on selected criteria
  const sortedBuyers = [...buyers].sort((a, b) => {
    switch (sortBy) {
      case 'joinDate':
        return new Date(b.joinDate) - new Date(a.joinDate)
      case 'totalOrders':
        return b.totalOrders - a.totalOrders
      case 'totalSpent':
        return b.totalSpent - a.totalSpent
      default:
        return 0
    }
  })

  // Filter buyers based on search term
  const filteredBuyers = sortedBuyers.filter(buyer => {
    const searchLower = searchTerm.toLowerCase()
    return (
      buyer.name.toLowerCase().includes(searchLower) ||
      buyer.email.toLowerCase().includes(searchLower) ||
      buyer.phone.toLowerCase().includes(searchLower) ||
      buyer.location.toLowerCase().includes(searchLower)
    )
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-600 text-white`
      case 'inactive':
        return `${baseClasses} bg-red-600 text-white`
      default:
        return `${baseClasses} bg-gray-600 text-white`
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Buyers</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Buyers Management</h1>
        <div className="flex items-center space-x-4">
          <div className="bg-white rounded-lg px-4 py-2 border">
            <span className="text-sm text-gray-600">Total Buyers:</span>
            <span className="ml-2 font-semibold text-[#711330]">{buyers.length}</span>
          </div>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="bg-white rounded-lg shadow-sm border mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">Search buyers</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#711330] focus:border-[#711330] sm:text-sm"
                placeholder="Search by name, email, phone, or location..."
              />
            </div>
          </div>
          
          <div className="sm:w-48">
            <label htmlFor="sort" className="sr-only">Sort by</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#711330] focus:border-[#711330] sm:text-sm"
            >
              <option value="joinDate">Sort by Join Date</option>
              <option value="totalOrders">Sort by Total Orders</option>
              <option value="totalSpent">Sort by Total Spent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Buyers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredBuyers.map((buyer) => (
          <div key={buyer.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {buyer.profileImage ? (
                      <Image
                        src={buyer.profileImage}
                        alt={buyer.name}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-[#711330] rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-lg">
                          {buyer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{buyer.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{buyer.email}</p>
                  </div>
                </div>
                <span className={getStatusBadge(buyer.status)}>
                  {buyer.status}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {buyer.phone || 'No phone'}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {buyer.location}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m0 0h3a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h3m4 0v1m-4-1V7m0 1h4" />
                  </svg>
                  Joined: {buyer.joinDate}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-[#711330]">{buyer.totalOrders}</p>
                    <p className="text-xs text-gray-500">Total Orders</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-[#711330]">{formatCurrency(buyer.totalSpent)}</p>
                    <p className="text-xs text-gray-500">Total Spent</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${buyer.emailValidated ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span>Email {buyer.emailValidated ? 'Verified' : 'Unverified'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${buyer.phoneValidated ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span>Phone {buyer.phoneValidated ? 'Verified' : 'Unverified'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredBuyers.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No buyers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'No buyers have registered yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
