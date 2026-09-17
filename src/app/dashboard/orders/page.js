'use client'

import { useState, useEffect } from 'react'
import { db } from '../../../lib/firebase'
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore'
import { safeToISOString } from '../../../lib/dateUtils'

// Map payment status and delivery status to display status
//
// NOTE: seller approval now happens BEFORE payment (awaiting_seller_approval ->
// approved_awaiting_payment -> buyer pays -> processing -> delivery -> completed).
// Because of that, paymentStatus is still 'pending' (not 'success') during the
// whole approval stage, so those checks must NOT be gated behind
// `paymentStatus === 'success'` anymore, or they never match and everything
// falls through to 'pending'. Also covers the 'waiting_approval' alias and the
// 'delivery' progress value, both of which are real values written by the API
// but were previously unhandled here.
const mapStatusToDisplayStatus = (paymentStatus, deliveryStatus) => {
  // Seller explicitly rejected the order during approval review
  if (deliveryStatus === 'rejected') {
    return 'rejected'
  }
  if (paymentStatus === 'failed' || deliveryStatus === 'cancelled') {
    return 'cancelled'
  }

  // Approval stage happens before payment succeeds, so check these first,
  // independent of paymentStatus.
  if (deliveryStatus === 'awaiting_seller_approval' || deliveryStatus === 'waiting_approval') {
    return 'awaiting_approval'
  }
  if (deliveryStatus === 'approved_awaiting_payment' || deliveryStatus === 'approved') {
    return 'approved'
  }

  if (paymentStatus === 'success') {
    if (deliveryStatus === 'completed') {
      return 'delivered'
    } else if (
      deliveryStatus === 'delivery' ||
      deliveryStatus === 'in_progress' ||
      deliveryStatus === 'preparing' ||
      deliveryStatus === 'processing'
    ) {
      return 'confirmed'
    }
  }

  return 'pending'
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, awaiting_approval, approved, rejected, confirmed, delivered, cancelled
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState(null)
  const [updatingOrder, setUpdatingOrder] = useState(null) // Track which order is being updated

  // Move calculateOrderTotal function here so it's available during useEffect
  const calculateOrderTotal = (items, pax = 1) => {
    if (!items || !Array.isArray(items)) {
      return 0
    }
    
    const subtotal = items.reduce((total, item) => {
      const itemPrice = item.price || 0
      const itemQuantity = item.quantity || 1
      return total + (itemPrice * itemQuantity)
    }, 0)
    
    // For catering orders, multiply by pax
    return subtotal * pax
  }

  const formatCurrency = (amount) => {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return 'Rp 0'
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  useEffect(() => {
    const setupRealtimeOrders = () => {
      try {
        // Query the 'orders' collection for all orders
        const ordersRef = collection(db, 'orders')
        // Remove orderBy to avoid issues if createdAt doesn't exist on all documents
        const unsubscribe = onSnapshot(ordersRef, 
          (snapshot) => {
            const ordersData = []
            // console.log('Total documents in orders collection:', snapshot.size)
            
            snapshot.forEach((doc) => {
              const orderData = doc.data()
              
              const orderItems = orderData.items || orderData.orderItems || []
              const orderPax = orderData.pax || 1
              
              // Use stored total amount from Firestore as primary source
              const storedTotal = orderData.totalAmount || orderData.total || 0
              const calculatedTotal = storedTotal > 0 ? storedTotal : calculateOrderTotal(orderItems, orderPax)
              
              ordersData.push({
                id: doc.id,
                buyerName: orderData.buyerName || orderData.customerName || 'Unknown Customer',
                buyerEmail: orderData.buyerEmail || orderData.customerEmail || '',
                sellerName: orderData.sellerName || orderData.restaurantName || 'Unknown Seller',
                items: orderItems,
                totalAmount: calculatedTotal,
                status: mapStatusToDisplayStatus(orderData.status, orderData.statusProgress),
                paymentStatus: orderData.status || 'pending',
                deliveryStatus: orderData.statusProgress || 'pending',
                orderType: orderData.orderType || 'Regular',
                orderDate: safeToISOString(orderData.createdAt),
                deliveryDate: safeToISOString(orderData.deliveredAt),
                paymentMethod: orderData.paymentType || orderData.paymentMethod || 'Unknown',
                deliveryAddress: orderData.deliveryAddress || orderData.address || 'Unknown Address',
                cancelReason: orderData.cancelReason || null,
                rejectReason: orderData.rejectReason || null,
                pax: orderPax,
                distance: orderData.distance || 0,
                rawData: orderData // Keep raw data for debugging
              })
            })
            
            // Sort newest first. Done client-side (instead of a Firestore
            // orderBy) because not every order doc is guaranteed to have
            // createdAt, and safeToISOString() always returns a valid date
            // string, so this sort is safe even for older/incomplete docs.
            ordersData.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())

            // console.log('Found orders:', ordersData.length)
            setOrders(ordersData)
            setLoading(false)
            setError(null)
          },
          (error) => {
            console.error('Error fetching orders:', error)
            setError('Failed to load orders data')
            setLoading(false)
          }
        )
        
        return unsubscribe
      } catch (error) {
        console.error('Error setting up orders listener:', error)
        setError('Failed to connect to database')
        setLoading(false)
        return null
      }
    }

    const unsubscribe = setupRealtimeOrders()
    return () => unsubscribe && unsubscribe()
  }, [])

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      setUpdatingOrder(orderId) // Set loading state
      console.log(`Updating order ${orderId} to status: ${newStatus}`)
      
      // Update order status in Firebase
      const orderRef = doc(db, 'orders', orderId)
      
      // Map display status to appropriate fields
      let updateData = {
        updatedAt: new Date()
      }
      
      switch (newStatus) {
        case 'confirmed':
          updateData.status = 'success' // Payment confirmed
          updateData.statusProgress = 'awaiting_seller_approval' // Go to seller approval first
          console.log('Payment confirmed, awaiting seller approval for order:', orderId)
          break
        case 'awaiting_approval':
          updateData.status = 'success' // Payment already confirmed
          updateData.statusProgress = 'awaiting_seller_approval' // Explicitly set to awaiting approval
          console.log('Setting order to awaiting seller approval:', orderId)
          break
        case 'approved':
          updateData.status = 'success'
          updateData.statusProgress = 'approved' // Stays in its own "Disetujui" bucket, doesn't jump to confirmed/processing
          updateData.approvedAt = new Date()
          console.log('Seller approved order:', orderId)
          break
        case 'rejected':
          updateData.status = 'failed'
          updateData.statusProgress = 'rejected' // Stays in its own "Ditolak" bucket, separate from admin-cancelled
          updateData.rejectedAt = new Date()
          console.log('Seller rejected order:', orderId)
          break
        case 'delivered':
          updateData.status = 'success'
          updateData.statusProgress = 'completed'
          updateData.deliveredAt = new Date()
          console.log('Marking order as delivered:', orderId)
          break
        case 'cancelled':
          updateData.status = 'failed'
          updateData.statusProgress = 'cancelled'
          updateData.cancelledAt = new Date()
          console.log('Cancelling order:', orderId)
          break
        case 'pending':
          updateData.status = 'pending'
          updateData.statusProgress = 'pending'
          break
        default:
          updateData.status = newStatus
      }
      
      console.log('Update data:', updateData)
      await updateDoc(orderRef, updateData)
      console.log('Order status updated successfully')
      
      // Show success message
      let successMessage = `Order ${orderId} has been updated!`
      if (newStatus === 'confirmed') {
        successMessage = `Payment confirmed for order ${orderId}. Awaiting seller approval.`
      } else if (newStatus === 'awaiting_approval') {
        successMessage = `Order ${orderId} is now awaiting seller approval.`
      } else if (newStatus === 'approved') {
        successMessage = `Order ${orderId} has been approved (Disetujui).`
      } else if (newStatus === 'rejected') {
        successMessage = `Order ${orderId} has been rejected (Ditolak).`
      } else if (newStatus === 'delivered') {
        successMessage = `Order ${orderId} has been marked as delivered.`
      } else if (newStatus === 'cancelled') {
        successMessage = `Order ${orderId} has been cancelled.`
      }
      alert(successMessage)
      
      // The real-time listener will automatically update the local state
    } catch (error) {
      console.error('Error updating order status:', error)
      console.error('Order ID:', orderId)
      console.error('New Status:', newStatus)
      alert(`Failed to update order status: ${error.message}. Please try again.`)
    } finally {
      setUpdatingOrder(null) // Clear loading state
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.sellerName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getFilterDisplayText = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return 'Awaiting Approval'
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-600 text-white`
      case 'awaiting_approval':
        return `${baseClasses} bg-orange-600 text-white`
      case 'approved':
        return `${baseClasses} bg-emerald-600 text-white`
      case 'rejected':
        return `${baseClasses} bg-rose-700 text-white`
      case 'confirmed':
        return `${baseClasses} bg-blue-600 text-white`
      case 'delivered':
        return `${baseClasses} bg-green-600 text-white`
      case 'cancelled':
        return `${baseClasses} bg-red-600 text-white`
      default:
        return `${baseClasses} bg-gray-600 text-white`
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': 
        return (
          <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
          </svg>
        )
      case 'awaiting_approval':
        return (
          <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
        )
      case 'approved':
        return (
          <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
          </svg>
        )
      case 'rejected':
        return (
          <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        )
      case 'confirmed': 
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
        )
      case 'delivered': 
        return (
          <svg className="w-4 h-4 text-[#711330]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z"/>
          </svg>
        )
      case 'cancelled': 
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        )
      default: 
        return (
          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
          </svg>
        )
    }
  }

  const OrderCard = ({ order }) => (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Order {order.id}</h3>
            <p className="text-sm text-gray-600">{order.buyerName} • {order.buyerEmail}</p>
          </div>
          <div className="text-right">
            <span className={getStatusBadge(order.status)}>
              {getStatusIcon(order.status)} {order.status}
            </span>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.orderDate).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Details */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Order Details</h4>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Seller:</span>
                <span className="ml-2 text-sm text-gray-900">{order.sellerName}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Payment:</span>
                <span className="ml-2 text-sm text-gray-900">{order.paymentMethod}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Total:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
              {order.deliveryDate && (
                <div>
                  <span className="text-sm text-gray-500">Delivered:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {new Date(order.deliveryDate).toLocaleString()}
                  </span>
                </div>
              )}
              {order.cancelReason && (
                <div>
                  <span className="text-sm text-gray-500">Cancel Reason:</span>
                  <span className="ml-2 text-sm text-red-600">{order.cancelReason}</span>
                </div>
              )}
              {order.rejectReason && (
                <div>
                  <span className="text-sm text-gray-500">Reject Reason:</span>
                  <span className="ml-2 text-sm text-rose-600">{order.rejectReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items & Address */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Items</h4>
            <div className="space-y-2 mb-4">
              {order.items.map((item, index) => {
                const quantity = item.quantity || 1
                const pax = order.pax || 1
                const isCateringOrder = order.orderType && order.orderType.toLowerCase().includes('catering')

                return (
                  <div key={index} className="text-sm">
                    <span className="text-gray-900">
                      {quantity}x {item.name}
                      {isCateringOrder && pax > 1 && (
                        <span className="text-gray-500 ml-1">({pax} pax)</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery Address</h4>
            <p className="text-sm text-gray-600">{order.deliveryAddress}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button className="text-sm text-gray-600 hover:text-gray-900">
              View Full Details
            </button>
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Contact Buyer
            </button>
            {order.status === 'delivered' && (
              <button className="text-sm text-gray-600 hover:text-gray-900">
                Generate Invoice
              </button>
            )}
          </div>
          {order.status === 'pending' && (
            <div className="flex space-x-2">
              <button
                onClick={() => handleStatusChange(order.id, 'cancelled')}
                disabled={updatingOrder === order.id}
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingOrder === order.id ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-700" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cancelling...
                  </>
                ) : (
                  'Cancel'
                )}
              </button>
              <button
                onClick={() => handleStatusChange(order.id, 'confirmed')}
                disabled={updatingOrder === order.id}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-[#711330] hover:bg-[#8b1538] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingOrder === order.id ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Confirming...
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            </div>
          )}
          {order.status === 'awaiting_approval' && (
            <div className="flex space-x-2">
              <button
                onClick={() => handleStatusChange(order.id, 'rejected')}
                disabled={updatingOrder === order.id}
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingOrder === order.id ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-700" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </button>
              <button
                onClick={() => handleStatusChange(order.id, 'approved')}
                disabled={updatingOrder === order.id}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingOrder === order.id ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Approving...
                  </>
                ) : (
                  'Approve Order'
                )}
              </button>
            </div>
          )}
          {(order.status === 'approved' || order.status === 'confirmed') && (
            <button
              onClick={() => handleStatusChange(order.id, 'delivered')}
              disabled={updatingOrder === order.id}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingOrder === order.id ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Delivering...
                </>
              ) : (
                'Mark Delivered'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#711330] mb-4"></div>
        <p className="text-gray-600">Loading orders data...</p>
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
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor and manage all orders across the platform.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-500">Live data</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'awaiting_approval', 'approved', 'rejected', 'confirmed', 'delivered', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                filter === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {getStatusIcon(status)} {getFilterDisplayText(status)}
              {status !== 'all' && (
                <span className="ml-1 bg-gray-200 text-gray-600 py-0.5 px-1.5 rounded-full text-xs">
                  {orders.filter(o => o.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#711330] focus:border-[#711330]"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-[#711330] rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                  <dd className="text-lg font-medium text-gray-900">{orders.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {orders.filter(o => o.status === 'pending').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-[#711330] rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z"/>
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Delivered</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {orders.filter(o => o.status === 'delivered').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">No orders match your current filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}