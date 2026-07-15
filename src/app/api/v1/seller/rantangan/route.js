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
    const rantanganPackages = sellerData.rantanganPackages || getDefaultRantanganPackages();

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

// PUT: Update Rantangan packages (batch update)
export async function PUT(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const body = await request.json();
    let packages = body.packages;

    if (!Array.isArray(packages) || packages.length !== 3) {
      return withCORSHeaders(createErrorResponse('Payload must be an array of 3 packages', 400));
    }

    // Validate each package
    for (const pkg of packages) {
      if (
        pkg.type === undefined || pkg.type === null || pkg.type === '' ||
        pkg.name === undefined || pkg.name === null || pkg.name === '' ||
        pkg.description === undefined || pkg.description === null || pkg.description === '' ||
        pkg.price === undefined || pkg.price === null || pkg.price === '' || isNaN(Number(pkg.price))
      ) {
        return withCORSHeaders(createErrorResponse('All fields are required', 400));
      }
    }

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    // Update all packages
    const updatedPackages = packages.map(pkg => ({
      ...pkg,
      type: pkg.type.toLowerCase(),
      price: parseFloat(pkg.price),
      updatedAt: new Date().toISOString(),
    }));

    await sellerRef.update({ rantanganPackages: updatedPackages });

    return withCORSHeaders(createSuccessResponse({ data: updatedPackages }, 'Rantangan packages updated successfully'));
  } catch (error) {
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

export async function DELETE(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authREsult.status));
    }

    const { sellerId } = authResult;
    const pathSegments = url.pathname.split('/');
    const packageId = pathSegments[pathSegments.length - 1];

    if(!packageId) {
      return withCORSHeaders(createErrorResponse('Package ID required', 400));
    }

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
