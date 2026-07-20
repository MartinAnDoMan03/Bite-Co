'use client'

import { useState, useEffect } from 'react'
import { db, storage } from '../../../lib/firebase'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export default function PromosPage() {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    startDate: '',
    endDate: '',
    isActive: true,
    type: 'info',
    discountAmount: '',
  })

  useEffect(() => {
    const q = query(collection(db, 'promos'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setPromos(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const resetForm = () => {
    setForm({ title: '', description: '', imageUrl: '', startDate: '', endDate: '', isActive: true, type: 'info', discountAmount: '' })
    setEditingPromo(null)
  }

  const openCreate = () => { resetForm(); setModalOpen(true) }

  const openEdit = (promo) => {
    setEditingPromo(promo)
    setForm({
      title: promo.title || '',
      description: promo.description || '',
      imageUrl: promo.imageUrl || '',
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : '',
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : '',
      isActive: promo.isActive !== false,
      type: promo.type || 'info',
      discountAmount: promo.discountAmount || '',
    })
    setModalOpen(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const storageRef = ref(storage, `promos/${Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setForm(f => ({ ...f, imageUrl: url }))
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.title || !form.imageUrl) {
      alert('Title and image are required')
      return
    }
    const data = {
      title: form.title,
      description: form.description,
      imageUrl: form.imageUrl,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : new Date().toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      isActive: form.isActive,
      type: form.type,
      discountAmount: form.discountAmount ? Number(form.discountAmount) : null,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (editingPromo) {
        await updateDoc(doc(db, 'promos', editingPromo.id), data)
      } else {
        await addDoc(collection(db, 'promos'), { ...data, createdAt: new Date().toISOString() })
      }
      setModalOpen(false)
      resetForm()
    } catch (err) {
      alert('Error saving promo: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this promo?')) return
    try {
      await deleteDoc(doc(db, 'promos', id))
    } catch (err) {
      alert('Error deleting: ' + err.message)
    }
  }

  const handleToggleActive = async (promo) => {
    await updateDoc(doc(db, 'promos', promo.id), { isActive: !promo.isActive, updatedAt: new Date().toISOString() })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promos & Banners</h1>
          <p className="text-slate-500 text-sm mt-1">Manage promotional banners shown on the buyer home screen</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#711330] text-white px-4 py-2 rounded-xl font-medium hover:bg-[#8a1a3c] transition-colors"
        >
          + Add Promo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#711330]" />
        </div>
      ) : promos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium">No promos yet</p>
          <p className="text-sm mt-1">Click "Add Promo" to create your first banner</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {promos.map(promo => (
            <div key={promo.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="relative h-40 bg-slate-100">
                {promo.imageUrl ? (
                  <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">No image</div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#711330]/10 text-[#711330]">
                    {promo.type}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-900 truncate">{promo.title}</h3>
                <p className="text-slate-500 text-sm mt-1 line-clamp-2">{promo.description || '-'}</p>
                {promo.discountAmount && (
                  <p className="text-[#711330] font-semibold text-sm mt-1">Diskon: Rp {Number(promo.discountAmount).toLocaleString('id-ID')}</p>
                )}
                {promo.endDate && (
                  <p className="text-slate-400 text-xs mt-1">Ends: {new Date(promo.endDate).toLocaleDateString('id-ID')}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${promo.isActive ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                  >
                    {promo.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEdit(promo)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#711330] text-[#711330] hover:bg-[#711330]/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(promo.id)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingPromo ? 'Edit Promo' : 'Add Promo'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Title *</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#711330]/30"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Promo Ramadan 50%"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
                <textarea
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#711330]/30 resize-none"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Short description of the promo"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Banner Image *</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-slate-600" />
                {uploading && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
                {form.imageUrl && !uploading && (
                  <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-full object-cover rounded-xl border border-slate-200" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#711330]/30"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#711330]/30"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Type</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#711330]/30"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="info">Info</option>
                    <option value="discount">Discount</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Discount Amount (Rp)</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#711330]/30"
                    value={form.discountAmount}
                    onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-[#711330]"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Active (show on app)</label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => { setModalOpen(false); resetForm() }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                className="flex-1 py-2 rounded-xl bg-[#711330] text-white font-medium hover:bg-[#8a1a3c] transition-colors disabled:opacity-50"
              >
                {editingPromo ? 'Save Changes' : 'Create Promo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}