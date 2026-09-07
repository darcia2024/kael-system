/**
 * KAEL System · Google Places & Review URL Builder (KAEL Review 6.1)
 * 
 * Aturan Pembentukan URL Review Google:
 * 1. Bentuk yang benar memakai endpoint writereview:
 *    https://search.google.com/local/writereview?placeid={place_id}
 * 2. Mencegah link share maps biasa atau g.page yang hanya membuka halaman profil.
 * 3. Menyimpan google_place_id di database sehingga bila struktur URL Google berubah di masa depan,
 *    dapat dibentuk ulang otomatis.
 */

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  directReviewUrl: string;
}

/**
 * Membentuk URL resmi Google Write Review dari Place ID
 */
export function buildGoogleReviewUrl(placeId: string): string {
  const cleanId = placeId ? placeId.trim() : "";
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(cleanId)}`;
}

/**
 * Mencoba mengekstrak Place ID dari berbagai format input (URL writereview, query placeid, dll)
 */
export function extractPlaceIdFromInput(input: string): string | null {
  if (!input) return null;
  const str = input.trim();

  // 1. Jika sudah Place ID murni (alfanumerik + underscore/dash, biasanya diawali ChIJ... dan panjang ~27 karakter)
  if (/^[A-Za-z0-9_-]{20,50}$/.test(str) && !str.startsWith("http")) {
    return str;
  }

  // 2. Jika merupakan URL dengan parameter placeid
  try {
    const url = new URL(str);
    const placeidParam = url.searchParams.get("placeid");
    if (placeidParam) return placeidParam;

    // Cek path segments jika ada format /place/ChIJ...
    const match = str.match(/place_id=([A-Za-z0-9_-]+)/);
    if (match && match[1]) return match[1];
  } catch {
    // bukan URL valid
  }

  return null;
}

/**
 * Menandai apakah pencarian bisnis tersedia.
 *
 * Pencarian memerlukan GOOGLE_PLACES_API_KEY. Tanpa kunci itu, satu-satunya
 * jalan yang jujur adalah meminta owner menempelkan Place ID secara manual.
 */
export function isPlacesSearchConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

/**
 * Mengambil dua angka yang memang dapat dipakai sebagai snapshot reputasi.
 * Place Details dipilih karena tenant sudah menyimpan Place ID, sehingga tidak
 * perlu mencari ulang nama usaha dan berisiko menangkap tempat yang salah.
 */
export async function getGoogleReviewSnapshot(placeId: string): Promise<{
  rating: number;
  reviewCount: number;
} | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = placeId.trim();
  if (!key || !id) return null;
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[KAEL] Place Details menolak snapshot review:", response.status);
      return null;
    }
    const data = await response.json() as { rating?: number; userRatingCount?: number };
    if (!Number.isFinite(data.rating) || !Number.isFinite(data.userRatingCount)) return null;
    return { rating: Number(data.rating), reviewCount: Number(data.userRatingCount) };
  } catch (error) {
    console.error("[KAEL] Place Details gagal mengambil snapshot review", error);
    return null;
  }
}

/** Mengambil koordinat resmi sebuah Place ID untuk geofence absensi. */
export async function getGooglePlaceLocation(placeId: string): Promise<{
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
} | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = placeId.trim();
  if (!key || !/^[A-Za-z0-9_-]{20,80}$/.test(id)) return null;
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json() as { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } };
    if (!data.id || !Number.isFinite(data.location?.latitude) || !Number.isFinite(data.location?.longitude)) return null;
    return { placeId: data.id, name: data.displayName?.text ?? "Lokasi Google Maps", address: data.formattedAddress ?? "", latitude: Number(data.location?.latitude), longitude: Number(data.location?.longitude) };
  } catch (error) {
    console.error("[KAEL] Place Details gagal mengambil lokasi absensi", error);
    return null;
  }
}

/**
 * Mencari bisnis lewat Google Places API (Text Search v1).
 *
 * HANYA boleh dipanggil dari server: kunci API tidak boleh sampai ke browser.
 *
 * CATATAN PENTING
 * Versi sebelumnya memfilter daftar contoh, lalu kalau tidak ada yang cocok ia
 * MENGARANG Place ID dari hash nama yang diketik dan menyebutnya "Lokasi
 * Terverifikasi". Place ID karangan itu tidak ada di Google, sehingga kartu
 * yang diaktifkan dengannya mengarahkan setiap pelanggan ke halaman error, dan
 * pemilik usaha tidak punya cara mengetahuinya sampai ada yang komplain.
 *
 * Fungsi ini tidak pernah membuat Place ID. Kalau tidak ketemu, hasilnya kosong.
 */
export async function searchPlaces(query: string): Promise<GooglePlaceResult[]> {
  const q = query?.trim();
  if (!q || q.length < 3) return [];

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: q,
        regionCode: "ID",
        languageCode: "id",
        maxResultCount: 8,
      }),
      // Hasil pencarian bisnis jarang berubah dalam hitungan menit, dan tiap
      // panggilan ada biayanya.
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("[KAEL] Places API menolak permintaan:", res.status);
      return [];
    }

    const data = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
      }[];
    };

    return (data.places ?? []).map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "(tanpa nama)",
      address: p.formattedAddress ?? "",
      rating: p.rating,
      userRatingsTotal: p.userRatingCount,
      directReviewUrl: buildGoogleReviewUrl(p.id),
    }));
  } catch (err) {
    console.error("[KAEL] Places API gagal dihubungi:", err);
    return [];
  }
}
