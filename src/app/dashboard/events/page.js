'use client'

import { useState, useEffect } from 'react'
import { db } from '../../../lib/firebase'
import { collection, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [imageFile, setImageFile] = useState(null)

  const [form, setForm] = useState({
    name: '',
    shortName: '',
    location: '',
    startDate: '',
    endDate: '',
    isActive: true,
    termsAndConditions: '',
    themeColor: '#711330',
    sellerBannerImageUrl: '',
  })

  const inputStyle = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#711330]/30 bg-white";

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setEvents(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const resetForm = () => {
    setForm({
      name: '', shortName: '', location: '', startDate: '', endDate: '',
      isActive: true, termsAndConditions: '', themeColor: '#711330', sellerBannerImageUrl: '',
    })
    setImageFile(null)
    setEditingEvent(null)
  }

  const openCreate = () => { resetForm(); setModalOpen(true) }

  const openEdit = (event) => {
    setEditingEvent(event)
    setForm({
      name: event.name || '',
      shortName: event.shortName || '',
      location: event.location || '',
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      isActive: event.isActive !== false,
      termsAndConditions: event.termsAndConditions || '',
      themeColor: event.themeColor || '#711330',
      sellerBannerImageUrl: event.sellerBannerImageUrl || '',
    })
    setModalOpen(true)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran gambar terlalu besar! Maksimal 2MB.");
      e.target.value = '';
      return;
    }

    setImageFile(file)
    setForm(f => ({ ...f, sellerBannerImageUrl: URL.createObjectURL(file) }))
  }

  const handleSave = async () => {
    if (!form.name || (!form.sellerBannerImageUrl && !imageFile)) {
      alert('Nama event dan banner wajib diisi!')
      return
    }

    setUploading(true)

    try {
      if (editingEvent) {
        // Edit: field teks saja, tidak termasuk ganti banner
        const res = await fetch(`/api/v1/events/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            shortName: form.shortName || form.name,
            location: form.location || null,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            isActive: form.isActive,
            termsAndConditions: form.termsAndConditions,
            themeColor: form.themeColor || null,
          }),
        })
        const data = await res.json()
        if (!data.success) {
          alert("Gagal menyimpan: " + data.message)
          setUploading(false)
          return
        }
        setModalOpen(false)
        resetForm()
        setUploading(false)
        return
      }

      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('shortName', form.shortName || form.name)
      formData.append('location', form.location)
      formData.append('isActive', form.isActive)
      formData.append('termsAndConditions', form.termsAndConditions)
      formData.append('themeColor', form.themeColor)
      if (form.startDate) formData.append('startDate', form.startDate)
      if (form.endDate) formData.append('endDate', form.endDate)
      if (imageFile) formData.append('image', imageFile)

      const response = await fetch('/api/v1/events', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setModalOpen(false)
        resetForm()
      } else {
        alert("Gagal menyimpan: " + data.message)
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan event: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus event ini? Pendaftaran seller yang sudah ada tidak akan terhapus.')) return
    try {
      await deleteDoc(doc(db, 'events', id))
    } catch (err) {
      alert('Gagal menghapus: ' + err.message)
    }
  }

  const handleToggleActive = async (event) => {
    await updateDoc(doc(db, 'events', event.id), { isActive: !event.isActive, updatedAt: new Date().toISOString() })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola banner event yang tampil di beranda seller & pendaftaran mitra</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#711330] text-white px-4 py-2 rounded-xl font-medium hover:bg-[#8a1a3c] transition-colors"
        >
          + Buat Event
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#711330]" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium">Belum ada event</p>
          <p className="text-sm mt-1">Klik &quot;+ Buat Event&quot; untuk mulai membuat banner event.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="relative h-40 bg-slate-100 shrink-0">
                {event.sellerBannerImageUrl ? (
                  <img src={event.sellerBannerImageUrl} alt={event.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">Tanpa Gambar</div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold shadow-sm ${event.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {event.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                {event.themeColor && (
                  <div
                    className="absolute top-2 left-2 w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: event.themeColor }}
                    title={event.themeColor}
                  />
                )}
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-slate-900 truncate">{event.name}</h3>
                {event.location && (
                  <p className="text-xs font-medium text-slate-500 mt-1">{event.location}</p>
                )}
                <p className="text-slate-600 text-sm mt-2 line-clamp-2 flex-grow">{event.termsAndConditions || '-'}</p>
                {(event.startDate || event.endDate) && (
                  <p className="text-slate-400 text-xs mt-2">
                    {event.startDate} {event.endDate ? `- ${event.endDate}` : ''}
                  </p>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleActive(event)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${event.isActive ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                  >
                    {event.isActive ? 'Matikan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => openEdit(event)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-[#711330] text-[#711330] hover:bg-[#711330]/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            <div className="p-5 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">{editingEvent ? 'Edit Event' : 'Buat Event Baru'}</h2>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-6">

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wider">Informasi Dasar</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Nama Event *</label>
                    <input
                      className={inputStyle}
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Misal: KMI Expo 2026"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Nama Pendek (untuk header)</label>
                    <input
                      className={inputStyle}
                      value={form.shortName}
                      onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
                      placeholder="Misal: KMI Expo"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Lokasi</label>
                    <input
                      className={inputStyle}
                      value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Misal: Universitas Jenderal Soedirman"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Syarat & Ketentuan</label>
                    <textarea
                      className={`${inputStyle} resize-none`}
                      value={form.termsAndConditions}
                      onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))}
                      rows={5}
                      placeholder="1. Peserta wajib memiliki produk makanan/minuman...&#10;2. ..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wider">Banner {editingEvent && '(tidak bisa diganti lewat edit)'}</h3>
                {!editingEvent && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="text-sm text-slate-600 w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#711330]/10 file:text-[#711330] hover:file:bg-[#711330]/20 cursor-pointer"
                    />
                    <p className="text-xs text-slate-400 mt-1">Maksimal 2MB. Resolusi disarankan 16:9.</p>
                  </>
                )}
                {form.sellerBannerImageUrl && (
                  <img src={form.sellerBannerImageUrl} alt="preview" className="mt-4 h-32 w-auto object-cover rounded-xl border border-slate-200 shadow-sm" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Tema</h3>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Warna Aksen</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={form.themeColor}
                        onChange={e => setForm(f => ({ ...f, themeColor: e.target.value }))}
                        className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input
                        className={inputStyle}
                        value={form.themeColor}
                        onChange={e => setForm(f => ({ ...f, themeColor: e.target.value }))}
                        placeholder="#711330"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Dipakai untuk aksen di halaman syarat & ketentuan seller.</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Durasi & Status</h3>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Tanggal Mulai</label>
                    <input
                      type="date"
                      className={inputStyle}
                      value={form.startDate}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Tanggal Berakhir</label>
                    <input
                      type="date"
                      className={inputStyle}
                      value={form.endDate}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={form.isActive}
                      onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="w-5 h-5 accent-[#711330] rounded cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-sm font-bold text-slate-700 cursor-pointer">
                      Aktifkan Event
                    </label>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => { setModalOpen(false); resetForm() }}
                className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                disabled={uploading}
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl bg-[#711330] text-white font-semibold hover:bg-[#8a1a3c] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                   Menyimpan...
                  </>
                ) : (
                  editingEvent ? 'Simpan Perubahan' : 'Buat Event'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}