import { db, storage } from '@/firebase/configure';
import { NextResponse } from 'next/server';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdmin } from '@/lib/admin-auth';

export async function OPTIONS() {
    return handleOptions();
}

// GET: Fetch active promos
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') !== 'false';

        // PERBAIKAN TYPO DI SINI: collection (sebelumnya collectiuon)
        let query = db.collection('promos').orderBy('createdAt', 'desc');

        if (activeOnly) {
            query = query.where('isActive', '==', true);
        }

        const snapshot = await query.get();
        const promos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const validPromos = promos.filter(p => {
            if (!p.endDate) return true;
            return new Date(p.endDate) >= now;
        });

        return withCORSHeaders(NextResponse.json({ success: true, data: validPromos }));
    } catch (error) {
        console.error('Error fetching promos:', error);
        return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
    }
}

// POST: Create new promo via admin only
export async function POST(request) {
    try {
        verifyAdmin(request);

        // KITA GUNAKAN FORMDATA SEKARANG
        const formData = await request.formData();
        
        const title = formData.get('title');
        const description = formData.get('description');
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const isActive = formData.get('isActive') === 'true';
        const type = formData.get('type');
        const discountAmount = formData.get('discountAmount');
        const sellerId = formData.get('sellerId');
        const sellerName = formData.get('sellerName');
        const promoFor = formData.get('promoFor');
        const imageFile = formData.get('image'); // Ambil file gambar

        if (!title || !imageFile) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Title and image are required' }, { status: 400 }));
        }

        // PROSES UPLOAD GAMBAR KE FIREBASE STORAGE (ADMIN SDK)
        const imageBuffer = await imageFile.arrayBuffer();
        const fileName = `promos/${Date.now()}_${imageFile.name}`;
        const storageRef = storage.bucket().file(fileName);
        
        await storageRef.save(Buffer.from(imageBuffer), {
            metadata: { contentType: imageFile.type || 'image/jpeg' },
        });
        
        const imageUrlArr = await storageRef.getSignedUrl({
            action: 'read',
            expires: '03-09-2491'
        });
        const imageUrl = imageUrlArr[0];

        // SIMPAN KE FIRESTORE
        const newPromo = {
            title,
            description: description || '',
            imageUrl: imageUrl,
            startDate: startDate || new Date().toISOString(),
            endDate: endDate || null,
            isActive: isActive,
            type: type || 'info',
            discountAmount: discountAmount ? Number(discountAmount) : null,
            sellerId: sellerId || null,
            sellerName: sellerName || null,
            promoFor: promoFor || 'both',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const ref = await db.collection('promos').add(newPromo);

        return withCORSHeaders(NextResponse.json({
            success: true,
            message: 'Promo created successfully',
            data: { id: ref.id, ...newPromo }
        }, { status: 201 }));
    } catch (error) {
        console.error('Error creating promo:', error);
        return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
    }
}