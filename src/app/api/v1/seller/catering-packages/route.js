import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
    return handleOptions();
}

export async function GET(request) {
    try {
        const authResult = verifyToken(request);
        if (authResult.error) {
            return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
        }

        const sellerId = authResult.sellerId || authResult.id;
        const sellerRef = db.collection('sellers').doc(sellerId);
        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            return withCORSHeaders(NextResponse.json({ error: "Seller not found" }, { status: 404 }));
        }

        const packages = sellerDoc.data().cateringPackages || [];
        return withCORSHeaders(NextResponse.json({ data: packages }));

    } catch (error) {
        console.error('Error fetching catering packages:', error);
        return withCORSHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
    }
}

export async function POST(request) {
    try {
        const authResult = verifyToken(request);
        if (authResult.error) {
            return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
        }

        const sellerId = authResult.sellerId || authResult.id;
        const body = await request.json();

        if (!body.name || !body.price_per_pax || !body.min_pax || !body.slots) {
            return withCORSHeaders(NextResponse.json({ error: "Missing required fields" }, { status: 400 }));
        }

        const sellerRef = db.collection('sellers').doc(sellerId);
        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            return withCORSHeaders(NextResponse.json({ error: "Seller not found" }, { status: 404 }));
        }

        const newPackage = {
            id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: body.name,
            description: body.description || "",
            price_per_pax: Number(body.price_per_pax),
            min_pax: Number(body.min_pax),
            event_types: body.event_types || [],
            slots: body.slots || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const existingPackages = sellerDoc.data().cateringPackages || [];
        existingPackages.push(newPackage);

        await sellerRef.update({ cateringPackages: existingPackages });

        return withCORSHeaders(NextResponse.json({ 
            message: "Package created successfully", 
            data: newPackage 
        }, { status: 201 }));

    } catch (error) {
        console.error('Error creating catering package:', error);
        return withCORSHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
    }
}