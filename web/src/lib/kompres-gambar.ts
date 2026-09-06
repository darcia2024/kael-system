/**
 * Memperkecil foto di peramban sebelum dikirim ke server.
 *
 * Foto dari kamera ponsel biasanya 3-8 MB dan 4000 piksel lebarnya. Yang
 * dibutuhkan halaman menu cuma kotak 80 piksel di daftar dan gambar penuh
 * selebar layar ponsel. Mengirim yang aslinya berarti membuang kuota pemilik
 * warung untuk piksel yang tidak akan pernah terlihat, dan Server Action Next
 * sendiri menolak badan permintaan di atas satu megabita.
 *
 * Berjalan di peramban saja: memakai canvas dan createImageBitmap.
 */

/** Sisi terpanjang setelah diperkecil. Cukup untuk layar ponsel mana pun. */
const SISI_MAKS = 800;

/** Harus sama dengan batas di uploadImageAction dan di constraint tabelnya. */
const BATAS_BYTE = 400 * 1024;

/**
 * Mutu awal, lalu turun bertahap kalau hasilnya masih kebesaran. Berhenti di
 * 0.5: di bawah itu foto makanan mulai terlihat kotak-kotak, dan gambar jelek
 * lebih merugikan daripada gambar yang agak berat.
 */
const MUTU = [0.82, 0.7, 0.6, 0.5];

export type HasilKompresi = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * WebP jauh lebih kecil, tapi Safari lama tidak bisa MENULISNYA lewat canvas.
 * Ketika itu terjadi, toBlob diam-diam mengembalikan PNG — yang untuk foto
 * justru lebih besar dari aslinya. Karena itu jenisnya diperiksa dari hasilnya,
 * bukan diasumsikan dari yang diminta.
 */
function toBlobAsync(canvas: HTMLCanvasElement, mime: string, mutu: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, mutu));
}

function bacaSebagaiDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Berkas tidak terbaca."));
    reader.readAsDataURL(blob);
  });
}

async function muatGambar(file: File): Promise<{ sumber: CanvasImageSource; w: number; h: number }> {
  /**
   * `imageOrientation: "from-image"` memutar foto sesuai EXIF-nya. Tanpa ini,
   * foto potret dari ponsel tersimpan miring 90 derajat — persis seperti yang
   * terjadi kalau orang memotret menunya sambil berdiri.
   */
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { sumber: bitmap, w: bitmap.width, h: bitmap.height };
    } catch {
      // Peramban lama: jatuh ke jalur <img> di bawah.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Berkas bukan gambar yang bisa dibuka."));
      el.src = url;
    });
    return { sumber: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function kompresGambar(file: File): Promise<HasilKompresi> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Berkas yang dipilih bukan gambar.");
  }

  const { sumber, w, h } = await muatGambar(file);
  if (!w || !h) throw new Error("Ukuran gambar tidak terbaca.");

  const skala = Math.min(1, SISI_MAKS / Math.max(w, h));
  const lebar = Math.max(1, Math.round(w * skala));
  const tinggi = Math.max(1, Math.round(h * skala));

  const canvas = document.createElement("canvas");
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Peramban ini tidak bisa memproses gambar.");

  // Latar putih supaya PNG transparan tidak jadi hitam saat dikonversi ke JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lebar, tinggi);
  ctx.drawImage(sumber, 0, 0, lebar, tinggi);
  if ("close" in sumber && typeof sumber.close === "function") sumber.close();

  for (const mime of ["image/webp", "image/jpeg"]) {
    for (const mutu of MUTU) {
      const blob = await toBlobAsync(canvas, mime, mutu);
      // Jenis yang diminta tidak didukung: toBlob mengembalikan jenis lain.
      if (!blob || blob.type !== mime) break;
      if (blob.size <= BATAS_BYTE) {
        return {
          dataUrl: await bacaSebagaiDataUrl(blob),
          width: lebar,
          height: tinggi,
          bytes: blob.size,
        };
      }
    }
  }

  throw new Error("Gambar tetap terlalu besar setelah dikecilkan. Coba foto lain.");
}
