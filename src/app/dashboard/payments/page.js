'use client'

import { useState, useEffect, useCallback } from 'react'

const TABS = [
  { key: 'pending', label: 'Menunggu Verifikasi' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

export default function PaymentVerificationPage() {
  const [activeTab, setActiveTab] = useState('pending')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)

  const fetchOrders = useCallback(async (status) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/orders/pending-verification?status=${status}`, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data')
      setOrders(data.orders || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders(activeTab) }, [activeTab, fetchOrders])

  const formatRupiah = (amount) => `Rp ${(amount || 0).toLocaleString('id-ID')}`

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const handleVerify = async (orderId, action) => {
    const label = action === 'approve' ? 'MENYETUJUI' : 'MENOLAK'
    const confirmed = window.confirm(`Yakin ${label} pembayaran order ini?`)
    if (!confirmed) return

    setProcessingId(orderId)
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/verify-payment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memproses verifikasi')
      // Order yang baru diverifikasi otomatis pindah ke tab Disetujui/Ditolak
      // dan hilang dari daftar "Menunggu Verifikasi" saat data di-refetch.
      await fetchOrders(activeTab)
    } catch (err) {
      alert(`Gagal: ${err.message}`)
    } finally {
      setProcessingId(null)
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
        <p className="text-red-500 font-medium mb-2">Gagal memuat data</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button
          onClick={() => fetchOrders(activeTab)}
          className="px-4 py-2 bg-[#711330] text-white text-sm rounded-full hover:opacity-90"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  const isPendingTab = activeTab === 'pending'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Verifikasi Pembayaran QRIS</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cek bukti transfer dan konfirmasi pesanan yang menunggu verifikasi.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#711330] text-[#711330]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 bg-gray-100 text-gray-500 py-0.5 px-1.5 rounded-full text-xs">
              {orders.length !== undefined && activeTab === tab.key ? orders.length : ''}
            </span>
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="bg-white p-10 rounded-lg shadow text-center">
          <p className="text-gray-400">
            {activeTab === 'pending' && 'Tidak ada pembayaran yang menunggu verifikasi.'}
            {activeTab === 'approved' && 'Belum ada pembayaran yang disetujui.'}
            {activeTab === 'rejected' && 'Belum ada pembayaran yang ditolak.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-mono text-xs text-gray-400">{order.id}</p>
                  <p className="font-medium text-gray-900">{order.buyerName}</p>
                  <p className="text-sm text-gray-500">{order.sellerName}</p>
                </div>
                <p className="font-bold text-[#711330]">{formatRupiah(order.totalAmount)}</p>
              </div>

              {order.paymentProofUrl && (
                <img
                  src={order.paymentProofUrl}
                  alt="Bukti pembayaran"
                  className="w-full h-48 object-contain bg-gray-50 rounded-lg mb-3 cursor-pointer"
                  onClick={() => setPreviewImage(order.paymentProofUrl)}
                />
              )}

              {isPendingTab ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerify(order.id, 'approve')}
                    disabled={processingId === order.id}
                    className="flex-1 px-3 py-2 bg-[#711330] text-white text-sm rounded-full hover:opacity-90 disabled:opacity-40"
                  >
                    {processingId === order.id ? '...' : 'Setujui'}
                  </button>
                  <button
                    onClick={() => handleVerify(order.id, 'reject')}
                    disabled={processingId === order.id}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-full hover:bg-gray-50 disabled:opacity-40"
                  >
                    {processingId === order.id ? '...' : 'Tolak'}
                  </button>
                </div>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'approved' ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {activeTab === 'approved' ? '✓ Disetujui' : '✕ Ditolak'} · {formatDate(order.verifiedAt)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Preview" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  )
}