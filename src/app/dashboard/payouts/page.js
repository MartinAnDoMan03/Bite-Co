'use client'

import { useState, useEffect } from 'react'
import { db } from '../../../lib/firebase' // <-- SESUAIKAN jumlah '../' sesuai lokasi file kamu
import { collection, onSnapshot, query, where } from 'firebase/firestore'

export default function PayoutPage() {
  const [earnings, setEarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSeller, setExpandedSeller] = useState(null)
  const [markingPaid, setMarkingPaid] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'sellerEarnings'),
      where('payoutStatus', '==', 'pending')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = []
      snapshot.forEach((doc) => {
        data.push({ earningId: doc.id, ...doc.data() })
      })
      setEarnings(data)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching sellerEarnings:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Group earnings by seller (sama pola kayak AnalyticsPage groupBy category/location)
  const sellerMap = {}
  let grandTotal = 0

  earnings.forEach((e) => {
    if (!sellerMap[e.sellerId]) {
      sellerMap[e.sellerId] = {
        sellerId: e.sellerId,
        sellerName: e.sellerName || 'Unknown Seller',
        orderCount: 0,
        totalNetAmount: 0,
        earnings: [],
      }
    }
    sellerMap[e.sellerId].orderCount += 1
    sellerMap[e.sellerId].totalNetAmount += e.netAmount
    sellerMap[e.sellerId].earnings.push(e)
    grandTotal += e.netAmount
  })

  const sellers = Object.values(sellerMap).sort((a, b) => b.totalNetAmount - a.totalNetAmount)

  const formatRupiah = (amount) => `Rp ${amount.toLocaleString('id-ID')}`

  const handleMarkPaid = async (sellerId, sellerName) => {
    const confirmed = window.confirm(
      `Tandai semua earning "${sellerName}" sebagai SUDAH DIBAYAR?\n\nPastikan kamu sudah benar-benar transfer dana ke rekening seller ini sebelum konfirmasi.`
    )
    if (!confirmed) return

    setMarkingPaid(sellerId)
    try {
      // Aksi tulis data tetap lewat API route (bukan client Firestore write),
      // biar tervalidasi admin & pakai firebase-admin di server (lebih aman utk data keuangan)
      const res = await fetch(`/api/v1/admin/payouts/${sellerId}/mark-paid`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menandai lunas')

      alert(`Berhasil! ${data.updatedCount} order ditandai lunas.\nBatch ID: ${data.payoutBatchId}`)
      // Ga perlu manual refresh -- onSnapshot otomatis update begitu Firestore berubah
    } catch (err) {
      alert(`Gagal: ${err.message}`)
    } finally {
      setMarkingPaid(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#711330]"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payout Seller</h1>
        <p className="mt-1 text-sm text-gray-600">
          Rekap pendapatan seller yang belum dicairkan.
        </p>
      </div>

      {/* Ringkasan total */}
      <div className="bg-white overflow-hidden shadow rounded-lg mb-8">
        <div className="p-6">
          <p className="text-sm font-medium text-gray-500">Total Harus Dibayar (semua seller)</p>
          <p className="text-3xl font-bold text-[#711330] mt-1">{formatRupiah(grandTotal)}</p>
          <p className="text-sm text-gray-400 mt-1">{sellers.length} seller menunggu pembayaran</p>
        </div>
      </div>

      {/* Tabel rekap per seller */}
      {sellers.length === 0 ? (
        <div className="bg-white p-10 rounded-lg shadow text-center">
          <p className="text-gray-400">Belum ada earning yang pending saat ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Harus Dibayar</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sellers.map((seller) => (
                <>
                  <tr key={seller.sellerId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() =>
                          setExpandedSeller(expandedSeller === seller.sellerId ? null : seller.sellerId)
                        }
                        className="font-medium text-gray-900 hover:text-[#711330] flex items-center gap-2"
                      >
                        <span>{expandedSeller === seller.sellerId ? '▼' : '▶'}</span>
                        {seller.sellerName}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {seller.orderCount} order
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatRupiah(seller.totalNetAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleMarkPaid(seller.sellerId, seller.sellerName)}
                        disabled={markingPaid === seller.sellerId}
                        className="px-4 py-1.5 bg-[#711330] text-white text-sm rounded-full hover:opacity-90 disabled:opacity-50"
                      >
                        {markingPaid === seller.sellerId ? 'Memproses...' : 'Tandai Lunas'}
                      </button>
                    </td>
                  </tr>

                  {expandedSeller === seller.sellerId && (
                    <tr>
                      <td colSpan={4} className="bg-gray-50 px-6 py-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 text-xs uppercase">
                              <th className="text-left py-2">Order ID</th>
                              <th className="text-left py-2">Buyer</th>
                              <th className="text-left py-2">Gross</th>
                              <th className="text-left py-2">Fee ({seller.earnings[0]?.platformFeePercent}%)</th>
                              <th className="text-left py-2">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seller.earnings.map((e) => (
                              <tr key={e.earningId} className="border-t border-gray-100">
                                <td className="py-2 text-gray-500 font-mono text-xs">
                                  {e.orderId.slice(0, 12)}...
                                </td>
                                <td className="py-2 text-gray-600">{e.buyerName || '-'}</td>
                                <td className="py-2 text-gray-600">{formatRupiah(e.grossAmount)}</td>
                                <td className="py-2 text-gray-400">{formatRupiah(e.platformFee)}</td>
                                <td className="py-2 font-medium text-gray-900">
                                  {formatRupiah(e.netAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}