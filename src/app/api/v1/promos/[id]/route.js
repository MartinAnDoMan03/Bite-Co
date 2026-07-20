import { db } from "@/firebase/configure";
import { NextResponse } from 'next/server';
import { withCORSHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS() {
    return handleOptions();
}

// PUT: Update promo via admin only
export async function PUT(request, { params }) {
    try {
        const adminCookie = request.cookies.get('auth-token');
        if(!adminCookie) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }));
        }

        const { id } = params;
        const body = await request.json();

        const promoRef = db.collection('promos').doc(id);
        const promoDoc = await promoRef.get();

        if (!promoDoc.exists) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Promo not found' }, {status: 404}));
        }

        const updateData = {
            ...body,
            updatedAt: new Date().toISOString(),
        };
        delete updateData.id;
        delete updateData.createdAt;

        await promoRef.update(updateData);

        return withCORSHeaders(NextResponse.json({ success: true, message: 'Promo updated successfully' }));
    } catch (error) {
        console.error('Error updating promo:', error);
        return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
    }
}

// DELETE: delete promo via admin only
export async function DELETE(request, { params }) {
    try {
        const adminCookie = request.cookies.get('auth-token');
        if (!adminCookie) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }));
        }

        const { id } = params;
        const promoRef = db.collection('promos').doc(id);
        const promoDoc = await promoRef.get();

        if (!promoDoc.exists) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Promo not found'}, { status: 404 }));
        }

        await promoRef.delete();

        return withCORSHeaders(NextResponse.json({ success: true, message: 'Promo deleted successfully' }));
    } catch (error) {
        console.error('Error deleting promo:', error);
        return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
    }
}