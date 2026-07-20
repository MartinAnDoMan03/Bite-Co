import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

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

    // Query sellers collection for approved sellers with address and rantanganPackages
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

    const sellersWithRantangan = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Check if seller has rantanganPackages data
      if (data.rantanganPackages && Array.isArray(data.rantanganPackages) && data.rantanganPackages.length > 0) {
        // Check if at least one package has valid data (not default empty values)
        const hasValidPackages = data.rantanganPackages.some(pkg => 
          pkg.name && pkg.name !== 'isi disini' && 
          pkg.description && pkg.description !== 'isi disini' && 
          pkg.price && pkg.price > 0
        );

        if (hasValidPackages) {
          // Calculate distance if buyer and seller coordinates are available
          let distance = null;
          if (buyerLat && buyerLng && data.pinLat && data.pinLng) {
            distance = calculateDistance(buyerLat, buyerLng, data.pinLat, data.pinLng);
          }
          
          // Debug: Log available image fields
          console.log('Seller image fields for', data.name, ':', {
            storeBanner: data.storeBanner,
            banner: data.banner,
            logo: data.logo,
            storeIcon: data.storeIcon
          });
          
          sellersWithRantangan.push({
            id: doc.id,
            name: data.name || data.outletName || null,
            rating: data.rating || 0,
            address: data.address,
            logo: data.logo || data.storeIcon || null,
            banner: data.storeBanner || data.banner || data.logo || data.storeIcon || null,
            kelurahan: data.kelurahan || null,
            pinLat: data.pinLat || null,
            pinLng: data.pinLng || null,
            pinAddress: data.pinAddress || null,
            distance: distance,
            rantanganPackages: data.rantanganPackages,
            // Operating hours / status fields for buyer-side open/closed badge
            openTime: data.openTime || null,
            closeTime: data.closeTime || null,
            isManuallyClosed: data.isManuallyClosed || false,
          });
        }
      }
    });

    // Sort sellers by distance if available
    if (buyerLat && buyerLng) {
      sellersWithRantangan.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return withCORSHeaders(new Response(JSON.stringify({ sellers: sellersWithRantangan }), {
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
      hint: 'Check Firestore rules, collection name, and if Firestore is initialized properly.'
    };
    console.error('Error in GET /api/v1/seller/rantangan-list:', debugInfo);
    return withCORSHeaders(new Response(JSON.stringify({ error: debugInfo }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
}