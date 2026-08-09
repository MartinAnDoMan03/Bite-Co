import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return handleOptions();
}

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
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
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const filter = url.searchParams.get('filter') || 'all';
    const sortBy = url.searchParams.get('sort') || 'relevance';
    const buyerLat = parseFloat(url.searchParams.get('buyerLat'));
    const buyerLng = parseFloat(url.searchParams.get('buyerLng'));

    // console.log('[SEARCH] Query:', query, 'Filter:', filter, 'Sort:', sortBy);

    if (!query.trim()) {
      return withCORSHeaders(NextResponse.json({ results: [] }));
    }

    // Build search criteria
    let searchResults = [];

    // Search in sellers collection
    const sellersSnapshot = await db.collection('sellers').get();
    const sellers = [];

    for (const doc of sellersSnapshot.docs) {
      const sellerData = doc.data();
      const sellerId = doc.id;

      // Basic seller info
      const seller = {
        id: sellerId,
        name: sellerData.outletName || sellerData.name || '',
        address: sellerData.address || '',
        rating: sellerData.rating,
        type: 'seller',
        storeIcon: sellerData.storeIcon || null,
        pinLat: sellerData.pinLat || null,
        pinLng: sellerData.pinLng || null,
      };

      // Calculate distance if buyer location is available
      if (buyerLat && buyerLng && seller.pinLat && seller.pinLng) {
        seller.distance = calculateDistance(buyerLat, buyerLng, seller.pinLat, seller.pinLng);
      }

      // Check if seller matches search query
      const searchText = query.toLowerCase();
      const sellerText = (seller.name + ' ' + seller.address).toLowerCase();
      
      if (sellerText.includes(searchText)) {
        sellers.push(seller);
      }

      // Also search in seller's menu items
      try {
        const categories = Array.isArray(sellerData.categories) ? sellerData.categories : [];
        
        for (const category of categories) {
          const categoryName = category.name || '';
          const categoryMatches = categoryName.toLowerCase().includes(searchText);
          const menuItems = Array.isArray(category.items) ? category.items : [];

          for (const item of menuItems) {
            const itemText = (
              (item.name || '') + ' ' +
              (item.description || '') + ' ' +
              categoryName
            ).toLowerCase();
            
            if (itemText.includes(searchText) || categoryMatches) {
              searchResults.push({
                id: `${sellerId}_${item.id}`,
                name: item.name,
                description: item.description || '',
                price: item.price || 0,
                image: item.image || null,
                type: 'menu_item',
                sellerId: sellerId,
                sellerName: seller.name,
                sellerAddress: seller.address,
                sellerStoreIcon: seller.storeIcon,
                category: categoryName,
                distance: seller.distance,
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to search menu for seller ${sellerId}:`, error);
      }
    }

    // Add sellers to results
    searchResults = [...searchResults, ...sellers];

    // Apply filters
    if (filter !== 'all') {
      searchResults = searchResults.filter(item => {
        switch (filter) {
          case 'catering':
            return item.type === 'seller'; // Assume sellers offer catering
          case 'rantangan':
            return item.type === 'menu_item'; // Menu items are for rantangan
          case 'nearby':
            return item.distance !== null && item.distance <= 5; // Within 5km
          case 'popular':
            return item.rating >= 4.0; // High rated items
          default:
            return true;
        }
      });
    }

    // Apply sorting
    searchResults.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        
        case 'price_low':
          if (a.type !== 'menu_item' && b.type !== 'menu_item') return 0;
          if (a.type !== 'menu_item') return 1;
          if (b.type !== 'menu_item') return -1;
          return (a.price || 0) - (b.price || 0);
        
        case 'price_high':
          if (a.type !== 'menu_item' && b.type !== 'menu_item') return 0;
          if (a.type !== 'menu_item') return 1;
          if (b.type !== 'menu_item') return -1;
          return (b.price || 0) - (a.price || 0);
        
        case 'relevance':
        default:
          // Sort by relevance (exact matches first, then partial matches)
          const queryLower = query.toLowerCase();
          
          const aScore = calculateRelevanceScore(a, queryLower);
          const bScore = calculateRelevanceScore(b, queryLower);
          
          return bScore - aScore;
      }
    });

    // Limit results to 50 items
    searchResults = searchResults.slice(0, 50);

    // console.log(`[SEARCH] Found ${searchResults.length} results for "${query}"`);

    return withCORSHeaders(NextResponse.json({ 
      results: searchResults,
      query: query,
      total: searchResults.length,
      filter: filter,
      sort: sortBy,
    }));

  } catch (error) {
    console.error('[SEARCH] Error:', error);
    return withCORSHeaders(NextResponse.json({ 
      error: 'Search failed', 
      message: error.message 
    }, { status: 500 }));
  }
}

function calculateRelevanceScore(item, queryLower) {
  let score = 0;
  const name = (item.name || '').toLowerCase();
  const description = (item.description || '').toLowerCase();
  const address = (item.address || '').toLowerCase();

  // Exact name match gets highest score
  if (name === queryLower) score += 100;
  else if (name.startsWith(queryLower)) score += 50;
  else if (name.includes(queryLower)) score += 25;

  // Description matches
  if (description.includes(queryLower)) score += 10;

  // Address matches
  if (address.includes(queryLower)) score += 5;

  // Boost popular items
  if (item.rating >= 4.5) score += 5;
  if (item.rating >= 4.0) score += 2;

  // Boost nearby items
  if (item.distance !== null && item.distance <= 2) score += 10;
  else if (item.distance !== null && item.distance <= 5) score += 5;

  return score;
}
