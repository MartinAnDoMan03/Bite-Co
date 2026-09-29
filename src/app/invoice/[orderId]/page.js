import { db } from '@/firebase/configure';
import InvoiceView from './InvoiceView';

export default async function InvoicePage({ params, searchParams }) {
  const { orderId } = await params;
  const { token } = await searchParams;

  const orderSnap = await db.collection('orders').doc(orderId).get();

  if (!orderSnap.exists) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'Arial, sans-serif' }}>
        <h2>Invoice tidak ditemukan</h2>
      </div>
    );
  }

  const order = { id: orderSnap.id, ...orderSnap.data() };

  if (!order.invoiceToken || order.invoiceToken !== token) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'Arial, sans-serif' }}>
        <h2>Link tidak valid</h2>
        <p style={{ color: '#666' }}>Link invoice ini tidak valid atau sudah kedaluwarsa.</p>
      </div>
    );
  }

  const plainOrder = JSON.parse(JSON.stringify(order));
    return <InvoiceView order={plainOrder} />;
}