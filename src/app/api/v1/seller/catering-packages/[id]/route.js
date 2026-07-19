import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
    return handleOptions();
}

export async function PUT(request, { params }) {
    try {
        const { id } = params;
        const authResult = verifyToken(request);
        if (authResult.error) {
            return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
        }

        const sellerId = authResult.sellerId || authResult.id;
        const body = await request.json();

        const sellerRef = db.collection('sellers').doc(sellerId);
        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            return withCORSHeaders(NextResponse.json({ error: "Seller not found" }, { status: 404 }));
        }

        const packages = sellerDoc.data().cateringPackages || [];
        const packageIndex = packages.findIndex(pkg => pkg.id === id);

        if (packageIndex === -1) {
            return withCORSHeaders(NextResponse.json({ error: "Package not found" }, { status: 404 }));
        }

        packages[packageIndex] = {
            ...packages[packageIndex],
            name: body.name,
            description: body.description,
            price_per_pax: Number(body.price_per_pax),
            min_pax: Number(body.min_pax),
            event_types: body.event_types || [],
            slots: body.slots || [],
            updatedAt: new Date().toISOString(),
        };

        await sellerRef.update({ cateringPackages: packages });
        return withCORSHeaders(NextResponse.json({ message: "Package updated successfully" }));

    } catch (error) {
        console.error('Error updating catering package:', error);
        return withCORSHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = params;
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

        let packages = sellerDoc.data().cateringPackages || [];
        const updatedPackages = packages.filter(pkg => pkg.id !== id);

        if (packages.length === updatedPackages.length) {
            return withCORSHeaders(NextResponse.json({ error: "Package not found" }, { status: 404 }));
        }

        await sellerRef.update({ cateringPackages: updatedPackages });
        return withCORSHeaders(NextResponse.json({ message: "Package deleted successfully" }));

    } catch (error) {
        console.error('Error deleting catering package:', error);
        return withCORSHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
    }
}