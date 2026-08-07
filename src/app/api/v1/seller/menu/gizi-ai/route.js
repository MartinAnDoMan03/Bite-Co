import { db } from '@/firebase/configure';
import { verifyToken, createErrorResponse, createSuccessResponse } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// Susun prompt buat Gemini - minta balik JSON doang, biar gampang di-parse
const buildPrompt = (menuName, ingredientsText) => {
  return `Kamu adalah ahli gizi. Estimasikan nilai gizi PER PORSI untuk menu makanan Indonesia berikut.

Nama menu: ${menuName}
Bahan-bahan (jika disebutkan): ${ingredientsText || 'tidak disebutkan, perkirakan dari nama menu'}

Jawab HANYA dengan JSON valid, tanpa teks tambahan, tanpa markdown code block, persis format ini:
{
  "energi_kkal": 0,
  "karbohidrat_g": 0,
  "protein_g": 0,
  "lemak_g": 0,
  "lemak_jenuh_g": 0,
  "serat_g": 0,
  "natrium_mg": 0,
  "gula_g": 0,
  "kolesterol_mg": 0,
  "labels": ["Tinggi Protein"],
  "cooking_tips": ["tips singkat cara memasak lebih sehat"]
}`;
};

// Panggil Gemini API - key disimpan di env, tidak pernah dikirim ke client
const callGeminiAPI = async (menuName, ingredientsText) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum diset di environment');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(menuName, ingredientsText) }] }],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini tidak mengembalikan hasil yang valid');
  }

  // Bersihkan kalau Gemini bungkus jawabannya dengan ```json ... ```
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error('Gagal parse JSON dari Gemini: ' + cleaned.slice(0, 200));
  }
};

// POST: Analisis gizi satu menu pakai AI, simpan hasilnya ke Firestore
export async function POST(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const { sellerId } = authResult;
    const body = await request.json();
    const { categoryId, menuId, ingredients } = body;

    if (!categoryId || !menuId) {
      return withCORSHeaders(createErrorResponse('categoryId dan menuId wajib diisi', 400));
    }

    // Get seller document
    const sellerRef = db.collection('sellers').doc(sellerId);
    const sellerDoc = await sellerRef.get();

    if (!sellerDoc.exists) {
      return withCORSHeaders(createErrorResponse('Seller not found', 404));
    }

    const sellerData = sellerDoc.data();
    const categories = sellerData.categories || [];
    const categoryIndex = categories.findIndex((cat) => cat.id === categoryId);

    if (categoryIndex === -1) {
      return withCORSHeaders(createErrorResponse('Category not found', 404));
    }

    const menuIndex = categories[categoryIndex].items.findIndex((item) => item.id === menuId);
    if (menuIndex === -1) {
      return withCORSHeaders(createErrorResponse('Menu item not found', 404));
    }

    const menuItem = categories[categoryIndex].items[menuIndex];

    // Panggil AI
    const giziResult = await callGeminiAPI(menuItem.name, ingredients);

    // Simpan hasil ke dalam menu item yang sama
    categories[categoryIndex].items[menuIndex] = {
      ...menuItem,
      giziResult,
      giziAnalyzedAt: new Date().toISOString(),
    };

    await sellerRef.update({ categories });

    return withCORSHeaders(
      createSuccessResponse({ menuItem: categories[categoryIndex].items[menuIndex] }, 'Analisis gizi berhasil')
    );
  } catch (error) {
    console.error('Gizi AI analysis error:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}