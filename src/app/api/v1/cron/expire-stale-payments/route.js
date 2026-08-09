import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return withCORSHeaders(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const staleSnap = await db.collection('orders')
    .where('statusProgress', '==', 'approved_awaiting_payment')
    .where('createdAt', '<=', cutoff)
    .get();

  const updates = staleSnap.docs.map((doc) =>
    doc.ref.update({
      status: 'failed',
      statusProgress: 'cancelled',
      updatedAt: new Date().toISOString(),
    })
  );
  await Promise.all(updates);

  return withCORSHeaders(new Response(JSON.stringify({ expired: staleSnap.size }), { status: 200 }));
}