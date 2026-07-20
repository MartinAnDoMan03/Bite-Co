import { db, storage } from '@/firebase/configure';
import { NextResponse } from 'next/server';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyToken } from '@/lib/auth';
import { Activity } from 'react';

export async function OPTIONS() {
    return handleOptions();
}

// GET: Fetch active promos (buyer home banner)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') !== 'false';

        let query = db.collectiuon('promos').orderBy('createdAt', 'desc');

        if (activeOnly) {
            query = query.where('isActive', '==', true);
        }

        const snapshot = await query.get();
        const promos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Expired promos not included
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
        // Admin cookie check
        const adminCookie = request.cookies.get('auth-token');
        if(!adminCookie) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }));
        }

        const body = await request.json();
        const { title, description, imageUrl, startDate, endDate, isActive, type, discountAmount } = body;

        if (!title || !imageUrl) {
            return withCORSHeaders(NextResponse.json({ success: false, message: 'Title and image are required' }, { status: 400 }));
        }

        const newPromo = {
            title,
            description: description || '',
            imageUrl,
            startDate: startDate || new Date().toISOString(),
            endDate: endDate || null,
            isActive: isActive !== false,
            type: type || 'info', // 'discount', | 'info' | 'event'
            discountAmount: discountAmount || null,
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