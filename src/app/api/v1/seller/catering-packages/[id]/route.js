import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifySellerToken } from '@/middleware/sellerAuth';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
    return handleOptions();
}

// PUT: Update spesifik paket di dalam array
export async function PUT(request, { params }) {
    try {
        const { id } = params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return withCORSHeaders(NextResponse.json({ error: "Authorization header required" }, { status: 401 }));
        }

        const token = authHeader.substring(7);
        let sellerData = verifySellerToken(token);
        const body = await request.json();

        const sellerRef = db.collection('sellers').doc(sellerData.id);
        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            return withCORSHeaders(NextResponse.json({ error: "Seller not found" }, { status: 404 }));
        }

        const packages = sellerDoc.data().cateringPackages || [];
        const packageIndex = packages.findIndex(pkg => pkg.id === id);

        if (packageIndex === -1) {
            return withCORSHeaders(NextResponse.json({ error: "Package not found" }, { status: 404 }));
        }

        // Timpa data lama dengan data baru
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

// DELETE: Hapus spesifik paket dari array
export async function DELETE(request, { params }) {
    try {
        const { id } = params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return withCORSHeaders(NextResponse.json({ error: "Authorization header required" }, { status: 401 }));
        }

        const token = authHeader.substring(7);
        let sellerData = verifySellerToken(token);

        const sellerRef = db.collection('sellers').doc(sellerData.id);
        const sellerDoc = await sellerRef.get();

        if (!sellerDoc.exists) {
            return withCORSHeaders(NextResponse.json({ error: "Seller not found" }, { status: 404 }));
        }

        let packages = sellerDoc.data().cateringPackages || [];
        
        // Filter out paket yang mau dihapus
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