import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';

// Rumus Haversine untuk menghitung jarak (dalam KM)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "-";
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return (R * c).toFixed(1); 
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('q');
    const buyerLat = searchParams.get('lat');
    const buyerLng = searchParams.get('lng');
    
    if (!keyword) {
      return NextResponse.json({ success: true, data: [] });
    }

    const lowerKeyword = keyword.toLowerCase();

    const sellersSnapshot = await db.collection('sellers')
      .where('status', '==', 'approved')
      .get();

    const results = [];

    sellersSnapshot.forEach(doc => {
      const seller = doc.data();
      let matchedMenus = [];

      const isStoreMatch = seller.outletName && seller.outletName.toLowerCase().includes(lowerKeyword);

      if (seller.categories && Array.isArray(seller.categories)) {
        seller.categories.forEach(category => {
          if (category.items && Array.isArray(category.items)) {
            category.items.forEach(item => {
              if (item.name && item.name.toLowerCase().includes(lowerKeyword)) {
                matchedMenus.push(item.name);
              }
            });
          }
        });
      }

      if (seller.cateringPackages && Array.isArray(seller.cateringPackages)) {
        seller.cateringPackages.forEach(pkg => {
          if (pkg.name && pkg.name.toLowerCase().includes(lowerKeyword)) {
            matchedMenus.push(`Paket: ${pkg.name}`);
          }
        });
      }

      if (isStoreMatch || matchedMenus.length > 0) {
        // Hitung jarak jika koordinat tersedia
        let distance = "-";
        if (buyerLat && buyerLng && seller.pinLat && seller.pinLng) {
          distance = calculateDistance(
            parseFloat(buyerLat), parseFloat(buyerLng),
            parseFloat(seller.pinLat), parseFloat(seller.pinLng)
          );
        }

        results.push({
          id: doc.id,
          StoreName: seller.outletName || "-",
          storeKelurahan: seller.kelurahan || "",
          Logo: seller.storeIcon ? { uri: seller.storeIcon } : null, 
          Rating: seller.rating ? seller.rating.toString() : "-",
          Distance: distance,
          openTime: seller.openTime || null,
          closeTime: seller.closeTime || null,
          isManuallyClosed: seller.isManuallyClosed || false,
          matchedMenus: [...new Set(matchedMenus)] 
        });
      }
    });

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error("Search Error:", error);
    return NextResponse.json({ success: false, error: "Gagal mencari data" }, { status: 500 });
  }
}