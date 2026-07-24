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
    sellerId: '',
    sellerName: '',
    promoFor: 'both',
  })

  // Standarisasi style untuk input
  const inputStyle = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#711330]/30 bg-white";

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
    setForm({ title: '', description: '', imageUrl: '', startDate: '', endDate: '', isActive: true, type: 'info', discountAmount: '', sellerId: '', sellerName: '', promoFor: 'both' })
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
      sellerId: promo.sellerId || '',
      sellerName: promo.sellerName || '',
      promoFor: promo.promoFor || 'both',
    })
    setModalOpen(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Batasi ukuran file untuk mencegah loading lama
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran gambar terlalu besar! Maksimal 2MB.");
      e.target.value = ''; // Reset input
      return;
    }

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
      alert('Title and banner image are required')
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
      // Pastikan discount hanya tersimpan jika tipenya discount
      discountAmount: form.type === 'discount' && form.discountAmount ? Number(form.discountAmount) : null,
      updatedAt: new Date().toISOString(),
      sellerId: form.sellerId || null,
      sellerName: form.sellerName || null,
      promoFor: form.promoFor || null,
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
      {/* Header Halaman (Tetap sama) */}
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

      {/* List Promo (Tetap sama) */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#711330]" />
        </div>
      ) : promos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium">No promos yet</p>
            <p className="text-sm mt-1">Click &quot;Add Promo&quot; to create your first banner</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {promos.map(promo => (
            <div key={promo.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="relative h-40 bg-slate-100 shrink-0">
                {promo.imageUrl ? (
                  <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">No image</div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold shadow-sm ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#711330]/90 text-white shadow-sm capitalize">
                    {promo.type}
                  </span>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-slate-900 truncate">{promo.title}</h3>
                
                {/* Info Toko jika ada */}
                {promo.sellerName && (
                   <p className="text-xs font-medium text-slate-500 mt-1">
                     Target: <span className="text-[#711330]">{promo.sellerName}</span> ({promo.promoFor})
                   </p>
                )}
                
                <p className="text-slate-600 text-sm mt-2 line-clamp-2 flex-grow">{promo.description || '-'}</p>
                
                {promo.type === 'discount' && promo.discountAmount && (
                  <p className="text-[#711330] font-bold text-sm mt-2">Potongan: Rp {Number(promo.discountAmount).toLocaleString('id-ID')}</p>
                )}
                {promo.endDate && (
                  <p className="text-slate-400 text-xs mt-2">Berakhir: {new Date(promo.endDate).toLocaleDateString('id-ID')}</p>
                )}
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${promo.isActive ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                  >
                    {promo.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEdit(promo)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-[#711330] text-[#711330] hover:bg-[#711330]/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(promo.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">{editingPromo ? 'Edit Promo' : 'Buat Promo Baru'}</h2>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              
              {/* Bagian 1: Informasi Dasar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wider">Informasi Dasar</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Judul Promo *</label>
                    <input
                      className={inputStyle}
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Misal: Promo Ramadan 50%"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Deskripsi Singkat</label>
                    <textarea
                      className={`${inputStyle} resize-none`}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder="Penjelasan singkat mengenai promo ini..."
                    />
                  </div>
                  
                  {/* Grid untuk Tipe Promo & Diskon (Kondisional) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">Tipe Promo</label>
                      <select
                        className={inputStyle}
                        value={form.type}
                        onChange={e => {
                          const newType = e.target.value;
                          setForm(f => ({
                            ...f, 
                            type: newType,
                            // Reset discount amount jika tipe bukan discount
                            discountAmount: newType === 'discount' ? f.discountAmount : ''
                          }))
                        }}
                      >
                        <option value="info">Info / Pengumuman</option>
                        <option value="discount">Diskon Potongan Harga</option>
                        <option value="event">Event Spesial</option>
                      </select>
                    </div>
                    
                    {/* HANYA MUNCUL JIKA TIPE = DISCOUNT */}
                    {form.type === 'discount' && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nominal Diskon (Rp)</label>
                        <input
                          type="number"
                          className={inputStyle}
                          value={form.discountAmount}
                          onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))}
                          placeholder="Misal: 15000"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bagian 2: Gambar Banner */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wider">Gambar Banner *</h3>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="text-sm text-slate-600 w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#711330]/10 file:text-[#711330] hover:file:bg-[#711330]/20 cursor-pointer" 
                />
                <p className="text-xs text-slate-400 mt-1">Maksimal 2MB. Resolusi disarankan 16:9.</p>
                
                {uploading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-[#711330] font-medium">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#711330]"></div>
                    Mengunggah gambar...
                  </div>
                )}
                
                {form.imageUrl && !uploading && (
                  <img src={form.imageUrl} alt="preview" className="mt-4 h-32 w-auto object-cover rounded-xl border border-slate-200 shadow-sm" />
                )}
              </div>

              {/* Bagian 3: Target Seller & Durasi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Target Promo (Opsional)</h3>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">ID Seller</label>
                    <input
                      className={inputStyle}
                      value={form.sellerId}
                      onChange={e => setForm(f => ({ ...f, sellerId: e.target.value }))}
                      placeholder="ID dari Firebase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">Nama Toko</label>
                      <input
                        className={inputStyle}
                        value={form.sellerName}
                        onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))}
                        placeholder="Misal: Vitmenu"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">Berlaku Untuk</label>
                      <select
                        className={inputStyle}
                        value={form.promoFor}
                        onChange={e => setForm(f => ({ ...f, promoFor: e.target.value }))}
                      >
                        <option value="both">Keduanya</option>
                        <option value="catering">Catering</option>
                        <option value="rantangan">Rantangan</option>
                      </select>
                    </div>
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
                      Aktifkan Promo Ini Sekarang
                    </label>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Footer Modal */}
            <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => { setModalOpen(false); resetForm() }}
                className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl bg-[#711330] text-white font-semibold hover:bg-[#8a1a3c] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {editingPromo ? 'Simpan Perubahan' : 'Buat Promo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}