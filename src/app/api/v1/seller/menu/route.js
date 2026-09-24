import { db, storage } from '@/firebase/configure';
import { verifyToken, createErrorResponse, createSuccessResponse } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { NextResponse } from 'next/server';

// OPTIONS: Handle preflight requests for CORS
export async function OPTIONS() {
  return handleOptions();
}

// GET: Fetch all categories and menu items
export async function GET(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const sellerDoc = await db.collection('sellers').doc(sellerId).get();
    
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    const sellerData = sellerDoc.data();
    const categories = sellerData.categories || [];

    return withCORSHeaders(createSuccessResponse({ data: categories }));

  } catch (error) {
    console.error('Get menu error:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

// DELETE: Delete a menu item
export async function DELETE(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const { categoryId, menuId } = await request.json();

    // Validate input
    if (!categoryId || !menuId) {
      return withCORSHeaders(createErrorResponse('Category ID and Menu ID are required', 400));
    }

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();
    
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    // Update seller document
    const sellerData = sellerDoc.data();
    const categories = sellerData.categories || [];
    const categoryIndex = categories.findIndex(cat => cat.id === categoryId);

    if (categoryIndex === -1) {
      return withCORSHeaders(createErrorResponse('Category not found', 404));
    }

    // Remove menu item from category
    const menuIndex = categories[categoryIndex].items.findIndex(item => item.id === menuId);
    if (menuIndex === -1) {
      return withCORSHeaders(createErrorResponse('Menu item not found', 404));
    }

    categories[categoryIndex].items.splice(menuIndex, 1);

    // Update Firestore
    await sellerRef.update({ categories });

    return withCORSHeaders(createSuccessResponse({ message: 'Menu item deleted successfully' }));

  } catch (error) {
    console.error('Delete menu item error:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

// PUT: Update a menu item
export async function PUT(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const formData = await request.formData();
    
    const name = formData.get('name');
    const description = formData.get('description');
    const price = parseFloat(formData.get('price'));
    const categoryId = formData.get('category_id');
    const menuId = formData.get('menu_id');
    const imageFile = formData.get('image');
    const eventOnly = formData.get('eventOnly') === 'true';

    // Validate input
    if (!name || !description || !price || !categoryId || !menuId) {
      return withCORSHeaders(createErrorResponse('All fields are required', 400));
    }

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();
    
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    let imageUrl = null;
    if (imageFile) {
      // Upload image to Firebase Storage
      const buffer = await imageFile.arrayBuffer();
      const fileName = `menu-${Date.now()}.jpg`;
      const filePath = `sellers/${sellerId}/menu/${fileName}`;
      
      const fileRef = storage.bucket().file(filePath);
      await fileRef.save(Buffer.from(buffer), {
        metadata: {
          contentType: 'image/jpeg',
        },
      });

      // Get the public URL
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });
      imageUrl = url;
    }

    // Update seller document
    const sellerData = sellerDoc.data();
    const categories = sellerData.categories || [];
    const categoryIndex = categories.findIndex(cat => cat.id === categoryId);

    if (categoryIndex === -1) {
      return withCORSHeaders(createErrorResponse('Category not found', 404));
    }

    // Find and update menu item
    const menuIndex = categories[categoryIndex].items.findIndex(item => item.id === menuId);
    if (menuIndex === -1) {
      return withCORSHeaders(createErrorResponse('Menu item not found', 404));
    }

    // Update menu item
    categories[categoryIndex].items[menuIndex] = {
      ...categories[categoryIndex].items[menuIndex],
      name,
      description,
      price,
      eventOnly,
      ...(imageUrl && { image: imageUrl }),
      updatedAt: new Date().toISOString()
    };

    // Update Firestore
    await sellerRef.update({ categories });

    return withCORSHeaders(createSuccessResponse({ 
      menuItem: categories[categoryIndex].items[menuIndex] 
    }, 'Menu item updated successfully'));

  } catch (error) {
    console.error('Update menu item error:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}

// POST: Add new menu item to a category
export async function POST(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const formData = await request.formData();
    
    const name = formData.get('name');
    const description = formData.get('description');
    const price = parseFloat(formData.get('price'));
    const categoryId = formData.get('category_id');
    const imageFile = formData.get('image');
    const eventOnly = formData.get('eventOnly') === 'true';

    // Validate input
    if (!name || !description || !price || !categoryId) {
      return withCORSHeaders(createErrorResponse('All fields are required', 400));
    }

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();
    
    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    let imageUrl = null;
    if (imageFile) {
      // Upload image to Firebase Storage
      const buffer = await imageFile.arrayBuffer();
      const fileName = `menu-${Date.now()}.jpg`;
      const filePath = `sellers/${sellerId}/menu/${fileName}`;
      
      const fileRef = storage.bucket().file(filePath);
      await fileRef.save(Buffer.from(buffer), {
        metadata: {
          contentType: 'image/jpeg',
        },
      });

      // Get the public URL
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });
      imageUrl = url;
    }

    // Create new menu item
    const menuItem = {
      id: Date.now().toString(),
      name,
      description,
      price,
      image: imageUrl,
      createdAt: new Date().toISOString(),
      eventOnly
    };

    // Update seller document
    const sellerData = sellerDoc.data();
    const categories = sellerData.categories || [];
    const categoryIndex = categories.findIndex(cat => cat.id === categoryId);

    if (categoryIndex === -1) {
      return withCORSHeaders(createErrorResponse('Category not found', 404));
    }

    // Add menu item to category
    categories[categoryIndex].items = categories[categoryIndex].items || [];
    categories[categoryIndex].items.push(menuItem);

    // Update Firestore
    await sellerRef.update({ categories });

    return withCORSHeaders(createSuccessResponse({ menuItem }, 'Menu item added successfully'));

  } catch (error) {
    console.error('Add menu item error:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}
