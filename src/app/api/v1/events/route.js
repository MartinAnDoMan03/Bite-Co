import { db, storage } from '@/firebase/configure';
import { NextResponse } from 'next/server';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdmin } from '@/lib/admin-auth';
export const dynamic = 'force-dynamic';
export async function OPTIONS() {
    return handleOptions();
}

// GET: Fetch all events (dipakai admin panel) atau yang aktif saja (?active=true)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') === 'true';

        let query = db.collection('events').orderBy('createdAt', 'desc');
        if (activeOnly) {
            query = query.where('isActive', '==', true);
        }

        const snapshot = await query.get();
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return withCORSHeaders(NextResponse.json({ success: true, data: events }));
    } catch (error) {
        console.error('Error fetching events:', error);
        return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
    }
}

// POST: Create new event via admin only
export async function POST(request) {
    try {
        verifyAdmin(request);

        const formData = await request.formData();

        const name = formData.get('name');
        const shortName = formData.get('shortName');
        const location = formData.get('location');
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const isActive = formData.get('isActive') === 'true';
        const termsAndConditions = formData.get('termsAndConditions');
        const themeColor = formData.get('themeColor');
        const imageFile = formData.get('image');

        if (!name || !imageFile) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Nama event dan banner wajib diisi' }, { status: 400 }));
        }

        const imageBuffer = await imageFile.arrayBuffer();
        const fileName = `events/${Date.now()}_${imageFile.name}`;
        const storageRef = storage.bucket().file(fileName);

        await storageRef.save(Buffer.from(imageBuffer), {
            metadata: { contentType: imageFile.type || 'image/jpeg' },
        });

        const imageUrlArr = await storageRef.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });
        const sellerBannerImageUrl = imageUrlArr[0];

        const newEvent = {
            name,
            shortName: shortName || name,
            location: location || null,
            startDate: startDate || null,
            endDate: endDate || null,
            isActive,
            termsAndConditions: termsAndConditions || '',
            themeColor: themeColor || null,
            sellerBannerImageUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const ref = await db.collection('events').add(newEvent);

        return withCORSHeaders(NextResponse.json({
            success: true,
            message: 'Event created successfully',
            data: { id: ref.id, ...newEvent },
        }, { status: 201 }));
    } catch (error) {
        console.error('Error creating event:', error);
        return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
    }
}