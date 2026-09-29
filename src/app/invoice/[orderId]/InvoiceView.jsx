'use client';

export default function InvoiceView({ order }) {
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || item.quantity || 1), 0);
  const adminFee = order.adminFee || 0;
  const total = order.totalAmount || 0;
  const discount = Math.max(0, subtotal + adminFee - total);

  const formatRupiah = (amount) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 32, fontFamily: 'Arial, Helvetica, sans-serif', color: '#23272f' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { padding: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ textAlign: 'right', marginBottom: 16 }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#711330', color: 'white', border: 'none',
            padding: '10px 22px', borderRadius: 6, fontWeight: 'bold',
            cursor: 'pointer', fontSize: 14,
          }}
        >
          Download / Print PDF
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #711330', paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.png" alt="Bite&Co" style={{ height: 52, width: 'auto' }} />
          <div>
            <h1 style={{ color: '#711330', fontSize: 20, margin: 0 }}>Bite&amp;Co</h1>
            <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>Catering &amp; Event Order Platform</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#711330', textTransform: 'uppercase' }}>Invoice</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>#{order.id}</div>
        </div>
      </div>

      <div style={{ background: '#faf5f6', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
          <span style={{ color: '#888' }}>Tanggal</span>
          <span style={{ fontWeight: 600 }}>{formatDate(order.createdAt)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
          <span style={{ color: '#888' }}>Toko</span>
          <span style={{ fontWeight: 600 }}>{order.sellerName || '-'}</span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', background: '#f7f7f8', padding: '8px 6px', fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Item</th>
            <th style={{ textAlign: 'center', background: '#f7f7f8', padding: '8px 6px', fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Qty</th>
            <th style={{ textAlign: 'right', background: '#f7f7f8', padding: '8px 6px', fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Harga</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>{item.name || '-'}</td>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #f0f0f0', fontSize: 13, textAlign: 'center' }}>{item.qty ?? item.quantity ?? 1}</td>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #f0f0f0', fontSize: 13, textAlign: 'right' }}>{formatRupiah(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
            <span>Subtotal</span><span>{formatRupiah(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#2E7D32' }}>
              <span>Diskon</span><span>- {formatRupiah(discount)}</span>
            </div>
          )}
          {adminFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span>Biaya Admin</span><span>{formatRupiah(adminFee)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid #ddd', marginTop: 8, paddingTop: 8, color: '#711330' }}>
            <span>Total Pembayaran</span><span>{formatRupiah(total)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid #eee', paddingTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#666' }}>Terima kasih telah menggunakan Bite&amp;Co.</div>
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>Invoice ini dibuat otomatis oleh sistem Bite&amp;Co.</div>
      </div>
    </div>
  );
}