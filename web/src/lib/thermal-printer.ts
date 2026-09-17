/**
 * Penyambung printer thermal Bluetooth.
 *
 * MASALAH YANG DISELESAIKAN DI SINI
 *
 * Layar kasir dan layar dapur sama-sama memanggil `requestDevice()` setiap kali
 * mencetak. Menurut aturan Chrome, `requestDevice()` SELALU membuka dialog
 * pilih perangkat — sebuah situs web memang tidak pernah boleh menyambung ke
 * perangkat Bluetooth diam-diam, dan tidak ada flag yang bisa mematikannya.
 *
 * Akibatnya kasir memilih printernya berulang kali, satu kali per struk, di
 * tengah antrean pembeli. Dan karena permintaannya memakai `acceptAllDevices`,
 * yang muncul bukan cuma printernya: HP tetangga, earbud, dan TV ikut terdaftar
 * sebagai "Unknown or Unsupported Device" beserta alamat MAC-nya.
 *
 * Jalan keluarnya `getDevices()`: perangkat yang izinnya SUDAH pernah diberikan
 * di peramban ini dikembalikan tanpa dialog, jadi bisa langsung disambung.
 * Dialognya tinggal muncul sekali seumur peramban, saat printernya belum
 * dikenal — dan saat itu pun daftarnya sudah disaring ke printer saja.
 *
 * Yang TIDAK bisa dihilangkan: pemilihan pertama kali. Itu syarat keamanan
 * peramban, bukan kekurangan kode.
 */

/** Profil layanan ESC/POS yang dipakai printer thermal 58mm dan 80mm. */
export const LAYANAN_PRINTER = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

/** Jalur tulis di dalam layanan di atas. */
export const KARAKTERISTIK_PRINTER = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
];

/**
 * Printer yang sedang dipegang tab ini.
 *
 * Disimpan di tingkat modul, bukan di dalam komponen: satu peramban cuma punya
 * satu printer, dan kasir berpindah-pindah antara layar kasir dan layar dapur
 * tanpa perlu menyambung dua kali.
 */
let printerTersimpan: any = null;

/** Melupakan printer, misalnya setelah gagal dipakai atau diganti. */
export function lupakanPrinter() {
  printerTersimpan = null;
}

/** Sudah ada printer yang dikenal? Dipakai layar untuk menyesuaikan tombolnya. */
export function printerSudahDikenal() {
  return printerTersimpan !== null;
}

/**
 * Mengambil printer, sebisa mungkin TANPA memunculkan dialog.
 *
 * Urutannya: printer yang masih dipegang, lalu izin yang sudah tersimpan di
 * peramban, dan baru bertanya ke penggunanya kalau dua-duanya kosong.
 */
export async function ambilPrinter(bluetooth: any): Promise<any> {
  if (printerTersimpan) return printerTersimpan;

  if (typeof bluetooth.getDevices === "function") {
    try {
      const tersimpan: any[] = await bluetooth.getDevices();
      // Nama printer thermal umumnya diawali RPP, MTP, POS, atau Printer.
      const printer =
        tersimpan.find((d) => /rpp|mtp|pos|print|thermal/i.test(d.name ?? "")) ?? tersimpan[0];
      if (printer) {
        pasangPelepas(printer);
        printerTersimpan = printer;
        return printer;
      }
    } catch {
      // Peramban lama belum mendukung izin permanen; lanjut ke dialog.
    }
  }

  const device = await bluetooth.requestDevice({
    // Disaring ke printer saja. Dengan acceptAllDevices, daftarnya penuh
    // perangkat orang lain dan kasir harus mencari printernya sendiri.
    filters: [
      ...LAYANAN_PRINTER.map((service) => ({ services: [service] })),
      { namePrefix: "RPP" },
      { namePrefix: "MTP" },
      { namePrefix: "POS" },
      { namePrefix: "Printer" },
    ],
    optionalServices: LAYANAN_PRINTER,
  });

  pasangPelepas(device);
  printerTersimpan = device;
  return device;
}

/**
 * Printer yang mati atau keluar jangkauan melepas koneksinya sendiri. Kalau
 * tidak dilupakan di sini, cetak berikutnya menulis ke sesi yang sudah mati dan
 * gagal tanpa pernah menawarkan menyambung ulang.
 */
function pasangPelepas(device: any) {
  device.addEventListener?.("gattserverdisconnected", () => {
    if (printerTersimpan === device) printerTersimpan = null;
  });
}

/** Menyambung, atau memakai sambungan yang memang masih hidup. */
export async function sambungPrinter(device: any) {
  const server = device.gatt?.connected ? device.gatt : await device.gatt?.connect();
  if (!server) throw new Error("Printer tidak dapat dihubungkan.");
  return server;
}

/** Mencari jalur tulis ESC/POS pada printer yang sudah tersambung. */
export async function jalurTulisPrinter(server: any) {
  const service = await (async () => {
    for (const uuid of LAYANAN_PRINTER) {
      try {
        return await server.getPrimaryService(uuid);
      } catch {
        /* coba profil printer berikutnya */
      }
    }
    throw new Error("Profil ESC/POS printer belum dikenali.");
  })();

  for (const uuid of KARAKTERISTIK_PRINTER) {
    try {
      return await service.getCharacteristic(uuid);
    } catch {
      /* coba karakteristik berikutnya */
    }
  }
  throw new Error("Jalur tulis printer belum dikenali.");
}
