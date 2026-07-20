import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req) {
  try {
    // Debug: Check Firestore connection
    if (!db) {
      throw new Error('Firestore db is not initialized');
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

    // Try a simple query to see if collection exists and is accessible
    let testDocError = null;
    try {
      await db.collection('sellers').limit(1).get();
    } catch (e) {
      testDocError = e;
    }
    if (testDocError) {
      throw new Error('Test query to sellers collection failed: ' + testDocError.message);
    }

    // Query sellers collection for approved sellers with address
    let snapshot;
    try {
      snapshot = await db.collection('sellers')
        .where('status', '==', "approved")
        .where('address', '!=', null)
        .get();
    } catch (queryError) {
      throw new Error('Main query failed: ' + queryError.message);
    }

    if (!snapshot) {
      throw new Error('Snapshot is undefined');
    }

    const sellers = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Calculate distance if buyer and seller coordinates are available
      let distance = null;
      if (buyerLat && buyerLng && data.pinLat && data.pinLng) {
        distance = calculateDistance(buyerLat, buyerLng, data.pinLat, data.pinLng);
      }
      
      return {
        id: doc.id,
        name: data.name || data.outletName || null,
        rating: data.rating || 0,
        address: data.address,
        logo: data.logo || data.storeIcon || null,
        kelurahan: data.kelurahan || null,
        pinLat: data.pinLat || null,
        pinLng: data.pinLng || null,
        pinAddress: data.pinAddress || null,
        distance: distance,
        categories: data.categories || [], // Add categories data to the response
        // Operating hours / status fields for buyer-side open/closed badge
        openTime: data.openTime || null,
        closeTime: data.closeTime || null,
        isManuallyClosed: data.isManuallyClosed || false,
      };
    });

    // Sort sellers by distance if available
    if (buyerLat && buyerLng) {
      sellers.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return withCORSHeaders(new Response(JSON.stringify({ sellers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (error) {
    let debugInfo = {
      message: error.message,
      stack: error.stack,
      firebaseError: error?.code || null,
      firebaseMessage: error?.details || null,
      env: process.env.NODE_ENV,
      // Add more debug info
      hint: 'Check Firestore rules, collection name, and if Firestore is initialized properly.'
    };
    return withCORSHeaders(new Response(JSON.stringify({ error: debugInfo }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
}