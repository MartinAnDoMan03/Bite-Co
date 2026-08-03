'use client'

import { useState, useEffect, useCallback } from 'react'

export default function PayoutPage() {
  const [sellers, setSellers] = useState([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedSeller, setExpandedSeller] = useState(null)
  const [markingPaidId, setMarkingPaidId] = useState(null) // sekarang nyimpen earningId, bukan sellerId

  const fetchPayouts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/payouts', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data payout')

      setSellers(data.sellers || [])
      setGrandTotal(data.grandTotal || 0)
      setError(null)
    } catch (err) {
      console.error('Error fetching payouts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  const formatRupiah = (amount) => `Rp ${amount.toLocaleString('id-ID')}`

  // Tandai lunas SATU order/earning saja, bukan semua earning milik seller
  const handleMarkPaid = async (earningId, orderIdShort, sellerName) => {
    const confirmed = window.confirm(
      `Tandai order "${orderIdShort}..." (${sellerName}) sebagai SUDAH DIBAYAR?\n\nPastikan kamu sudah benar-benar transfer dana untuk order ini sebelum konfirmasi.`
    )
    if (!confirmed) return

    setMarkingPaidId(earningId)
    try {
      const res = await fetch(`/api/v1/admin/payouts/earning/${earningId}/mark-paid`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menandai lunas')

      await fetchPayouts()
    } catch (err) {
      alert(`Gagal: ${err.message}`)
    } finally {
      setMarkingPaidId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#711330]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-10 rounded-lg shadow text-center">
        <p className="text-red-500 font-medium mb-2">Gagal memuat data payout</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchPayouts() }}
          className="px-4 py-2 bg-[#711330] text-white text-sm rounded-full hover:opacity-90"
        >
          Coba Lagi
        </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rekening Tujuan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pending</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {seller.hasBankInfo ? (
                        <div>
                          <div className="font-medium text-gray-900">{seller.bankName}</div>
                          <div className="text-gray-500 font-mono text-xs">{seller.bankAccountNumber}</div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                          ⚠ Data rekening belum lengkap
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {seller.orderCount} order
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatRupiah(seller.totalNetAmount)}
                    </td>
                  </tr>

                  {expandedSeller === seller.sellerId && (
                    <tr>
                      <td colSpan={4} className="bg-gray-50 px-6 py-4">
                        {!seller.hasBankInfo && (
                          <p className="text-xs text-amber-700 mb-3">
                            ⚠ Lengkapi data rekening seller ini dulu sebelum menandai order manapun lunas.
                          </p>
                        )}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 text-xs uppercase">
                              <th className="text-left py-2">Order ID</th>
                              <th className="text-left py-2">Buyer</th>
                              <th className="text-left py-2">Gross</th>
                              <th className="text-left py-2">Fee ({seller.earnings[0]?.platformFeePercent}%)</th>
                              <th className="text-left py-2">Net</th>
                              <th className="text-right py-2">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seller.earnings.map((e) => {
                              const shortId = e.orderId.slice(0, 12)
                              return (
                                <tr key={e.earningId} className="border-t border-gray-100">
                                  <td className="py-2 text-gray-500 font-mono text-xs">
                                    {shortId}...
                                  </td>
                                  <td className="py-2 text-gray-600">{e.buyerName || '-'}</td>
                                  <td className="py-2 text-gray-600">{formatRupiah(e.grossAmount)}</td>
                                  <td className="py-2 text-gray-400">{formatRupiah(e.platformFee)}</td>
                                  <td className="py-2 font-medium text-gray-900">
                                    {formatRupiah(e.netAmount)}
                                  </td>
                                  <td className="py-2 text-right">
                                    <button
                                      onClick={() => handleMarkPaid(e.earningId, shortId, seller.sellerName)}
                                      disabled={markingPaidId === e.earningId || !seller.hasBankInfo}
                                      title={!seller.hasBankInfo ? 'Lengkapi data rekening seller ini terlebih dahulu' : undefined}
                                      className="px-3 py-1 bg-[#711330] text-white text-xs rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {markingPaidId === e.earningId ? '...' : 'Tandai Lunas'}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
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