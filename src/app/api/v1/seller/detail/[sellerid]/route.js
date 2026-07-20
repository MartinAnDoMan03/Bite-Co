// Next.js 15 App Router API route for seller detail
import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req, context) {
  try {
    const params = await context.params;
    const { sellerid } = params;
    if (!sellerid) {
      return withCORSHeaders(NextResponse.json({ message: 'Missing sellerid' }, { status: 400 }));
    }

    // Extract buyer location from query parameters
    const { searchParams } = new URL(req.url);
    const buyerLat = parseFloat(searchParams.get('buyerLat'));
    const buyerLng = parseFloat(searchParams.get('buyerLng'));

    // Function to calculate distance between two points using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radius of the Earth in kilometers
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c; // Distance in kilometers
      return Math.round(distance * 10) / 10; // Round to 1 decimal place
    };

    // Fetch seller document
    const docRef = db.collection('sellers').doc(sellerid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return withCORSHeaders(NextResponse.json({ message: 'Seller not found' }, { status: 404 }));
    }
    const data = docSnap.data();

    // Get categories array from seller document
    let categories = [];
    if (Array.isArray(data.categories)) {
      categories = data.categories.map(cat => ({
        name: cat.name || '-',
        items: Array.isArray(cat.items) ? cat.items.map(item => ({
          id: item.id || null,
          name: item.name || null,
          description: item.description || null,
          price: item.price || null,
          image: item.image || null,
        })) : []
      }));
    }

    // Calculate distance if buyer and seller coordinates are available
    let distance = null;
    if (buyerLat && buyerLng && data.pinLat && data.pinLng) {
      distance = calculateDistance(buyerLat, buyerLng, data.pinLat, data.pinLng);
    }

    const seller = {
      id: docSnap.id,
      name: data.name || data.outletName || null,
      outletName: data.outletName || data.name || null,
      storeIcon: data.storeIcon || data.logo || null,
      kelurahan: data.kelurahan || (data.address && data.address.kelurahan) || null,
      type: data.type || null,
      rating: data.rating || 0,
      rating_count: data.rating_count || 0,
      categories,
      storeBanner: data.storeBanner || data.banner || null, // Add this line
      banner: data.banner || data.storeBanner || null, // For compatibility
      distance: distance, // Add distance field
      // Add seller coordinates to response
      pinLat: data.pinLat || null,
      pinLng: data.pinLng || null,
      pinAddress: data.pinAddress || null,
      address: data.address || null,
      // Operating hours / status fields for buyer-side open/closed logic
      openTime: data.openTime || null,
      closeTime: data.closeTime || null,
      isManuallyClosed: data.isManuallyClosed || false,
    };
    console.log('Seller detail fetched:', seller);
    return withCORSHeaders(NextResponse.json({ seller }));
  } catch (error) {
    let debugInfo = {
      message: error.message,
      stack: error.stack,
      firebaseError: error?.code || null,
      firebaseMessage: error?.details || null,
      env: process.env.NODE_ENV,
      hint: 'Check Firestore rules, collection name, and if Firestore is initialized properly.'
    };
    console.error('Error in GET /api/v1/seller/detail/[sellerid]:', debugInfo);
    return withCORSHeaders(NextResponse.json({ error: debugInfo }, { status: 500 }));
  }
}