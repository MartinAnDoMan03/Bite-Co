import { db } from '@/firebase/configure';
import { verifyToken, createErrorResponse, createSuccessResponse } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// GET: Fetch Rantangan packages for a seller
export async function GET(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();
    
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    const sellerData = sellerDoc.data();
    let rantanganPackages = sellerData.rantanganPackages || getDefaultRantanganPackages();

    // Id field requirement
    rantanganPackages = rantanganPackages.map(pkg => ({
      ...pkg,
      id: pkg.id || pkg.type || `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    return withCORSHeaders(createSuccessResponse({ data: rantanganPackages }));

  } catch (error) {
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

export async function POST(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const body = await request.json();
    const { name, description, price } = body;

    if (!name || !description || price === undefined) {
      return withCORSHeaders(createErrorResponse('Missing required fields', 400));
    }

    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();

    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    const  newPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      price: parseFloat(price),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sellerData = sellerDoc.data();
    const packages = sellerData.rantanganPackages || [];
    packages.push(newPackage);

    await sellerRef.update({ rantanganPackages: packages});
    return withCORSHeaders(createSuccessResponse({ data: newPackage }, 'Package added successfully'));
  } catch (error) {
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

// PUT: Update SINGLE Rantangan package by ID
export async function PUT(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get('id'); 

    if (!packageId) {
      return withCORSHeaders(createErrorResponse('Package ID required for update', 400));
    }

    const { sellerId } = authResult;
    const body = await request.json();

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    let packages = sellerDoc.data().rantanganPackages || [];
    const packageIndex = packages.findIndex(pkg => pkg.id === packageId);

    if (packageIndex === -1) {
      return withCORSHeaders(createErrorResponse('Package not found', 404));
    }

    // Update HANYA paket yang ID-nya cocok
    packages[packageIndex] = {
      ...packages[packageIndex],
      name: body.name || packages[packageIndex].name,
      description: body.description || packages[packageIndex].description,
      price: body.price !== undefined ? parseFloat(body.price) : packages[packageIndex].price,
      updatedAt: new Date().toISOString(),
    };

    await sellerRef.update({ rantanganPackages: packages });

    return withCORSHeaders(createSuccessResponse({ data: packages[packageIndex] }, 'Rantangan package updated successfully'));
  } catch (error) {
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

export async function DELETE(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get('id');

    if (!packageId) {
      return withCORSHeaders(createErrorResponse('Package ID required', 400));
    }

    const { sellerId } = authResult;
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();

    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    const sellerData = sellerDoc.data();
    const packages = (sellerData.rantanganPackages || []).filter(pkg => pkg.id !== packageId);

    await sellerRef.update({ rantanganPackages: packages });
    return withCORSHeaders(createSuccessResponse({}, 'Package deleted successfully'));
  } catch (error) {
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

// Helper function to get default Rantangan packages
function getDefaultRantanganPackages() {
  return [
    {
      id: 'harian',
      type: 'harian',
      name: 'Paket Harian',
      description: 'isi disini',
      price: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'mingguan',
      type: 'mingguan',
      name: 'Paket Mingguan',
      description: 'isi disini',
      price: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'bulanan',
      type: 'bulanan',
      name: 'Paket Bulanan',
      description: 'isi disini',
      price: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}
