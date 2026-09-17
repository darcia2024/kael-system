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

/**
 * Antrean cetak. Satu pekerjaan selesai dulu, baru yang berikutnya jalan.
 *
 * Web Bluetooth TIDAK mengizinkan dua operasi GATT berjalan bersamaan pada satu
 * perangkat. Layar kasir melanggarnya tanpa sadar: "cetak otomatis 3 rangkap"
 * berjalan begitu transaksi selesai, lalu kasir menekan "Tiket Dapur" beberapa
 * detik kemudian — dan yang kedua langsung gagal dengan alasan yang terdengar
 * seperti printernya bermasalah, padahal printernya baik-baik saja.
 *
 * Rantai promise ini yang memaksa mereka mengantre.
 */
let antrean: Promise<unknown> = Promise.resolve();

function antre<T>(pekerjaan: () => Promise<T>): Promise<T> {
  // Kegagalan satu pekerjaan tidak boleh memutus antrean untuk yang berikutnya,
  // jadi rantainya selalu disambung dari versi yang sudah "dijinakkan".
  const hasil = antrean.then(pekerjaan, pekerjaan);
  antrean = hasil.catch(() => undefined);
  return hasil;
}

/** Sudah ada printer yang dikenal? Dipakai layar untuk menyesuaikan tombolnya. */
export function printerSudahDikenal() {
  return printerTersimpan !== null;
}

/**
 * Keterangan apa adanya soal keadaan printer.
 *
 * Ada supaya keluhan "harus pairing terus" bisa dijawab dengan pemeriksaan,
 * bukan tebakan. Jalankan di konsol peramban kasir:
 *
 *     await window.__kaelPrinter()
 *
 * `izinPermanenTersedia: false` berarti Chrome-nya belum menyimpan izin
 * perangkat lintas muat ulang halaman — dialognya akan muncul sekali tiap kali
 * halaman dibuka dari awal, dan itu dibereskan lewat
 * chrome://flags/#enable-web-bluetooth-new-permissions-backend
 */
export async function diagnosaPrinter() {
  const bluetooth = (navigator as Navigator & { bluetooth?: any }).bluetooth;
  if (!bluetooth) return { webBluetoothAda: false };

  let tersimpan: any[] = [];
  let izinPermanenTersedia = typeof bluetooth.getDevices === "function";
  if (izinPermanenTersedia) {
    try {
      tersimpan = await bluetooth.getDevices();
    } catch {
      izinPermanenTersedia = false;
    }
  }

  return {
    webBluetoothAda: true,
    izinPermanenTersedia,
    jumlahPerangkatTersimpan: tersimpan.length,
    namaPerangkatTersimpan: tersimpan.map((d) => d.name ?? "(tanpa nama)"),
    printerSedangDiingat: printerTersimpan?.name ?? null,
    printerSedangTersambung: Boolean(printerTersimpan?.gatt?.connected),
  };
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

  /**
   * Disaring ke printer saja. Dengan acceptAllDevices, daftarnya penuh HP
   * tetangga dan earbud, dan kasir harus mencari printernya sendiri di antara
   * belasan baris "Unknown or Unsupported Device".
   *
   * Tapi penyaring layanan cuma cocok kalau printernya benar-benar MENYIARKAN
   * UUID itu di paket iklannya, dan banyak printer thermal murah tidak. Jadi
   * kalau daftarnya berakhir kosong, pemilihan diulang tanpa penyaring —
   * daftar berisik jauh lebih baik daripada printer yang tidak bisa dipilih
   * sama sekali.
   */
  let device: any;
  try {
    device = await bluetooth.requestDevice({
      filters: [
        ...LAYANAN_PRINTER.map((service) => ({ services: [service] })),
        { namePrefix: "RPP" },
        { namePrefix: "MTP" },
        { namePrefix: "POS" },
        { namePrefix: "Printer" },
        { namePrefix: "BlueTooth Printer" },
        { namePrefix: "Thermal" },
      ],
      optionalServices: LAYANAN_PRINTER,
    });
  } catch (error) {
    const dibatalkanOrang = (error as Error)?.message?.toLowerCase().includes("cancel");
    if (dibatalkanOrang) throw error;

    console.warn("[KAEL] tidak ada printer yang cocok dengan penyaring; menampilkan semua perangkat", error);
    device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: LAYANAN_PRINTER,
    });
  }

  pasangPelepas(device);
  printerTersimpan = device;
  return device;
}

/**
 * Printer terputus BUKAN alasan melupakannya.
 *
 * Ini kekeliruan pada perbaikan sebelumnya. Printer thermal seperti RPP02N
 * memutus koneksinya SENDIRI setelah beberapa detik menganggur, demi menghemat
 * baterai — itu perilaku normal, bukan tanda ada yang rusak. Versi sebelumnya
 * menghapus printernya dari ingatan begitu peristiwa itu datang, sehingga cetak
 * berikutnya kembali memanggil requestDevice() dan dialognya muncul lagi.
 * Hasilnya persis seperti sebelum diperbaiki.
 *
 * Objek perangkatnya sendiri tetap sah setelah terputus, dan gatt.connect()
 * bisa menyambungkannya kembali TANPA dialog selama izinnya masih hidup. Jadi
 * yang dicatat di sini cuma keterangan; printernya tetap diingat.
 */
function pasangPelepas(device: any) {
  device.addEventListener?.("gattserverdisconnected", () => {
    console.info("[KAEL] printer menganggur lalu memutus sendiri; akan disambung ulang saat cetak berikutnya");
  });
}

/**
 * Menerjemahkan galat Web Bluetooth jadi kalimat yang berguna buat kasir.
 *
 * Pesan lamanya cuma "Printer Bluetooth belum bisa menerima tiket dapur" —
 * terdengar seperti printernya rusak, padahal penyebab paling sering justru
 * dialognya ditutup, atau printernya sedang mengerjakan cetakan sebelumnya.
 * Kasir yang membaca pesan yang salah akan memperbaiki hal yang salah.
 */
export function alasanGagalCetak(error: unknown): string {
  const pesan = (error as Error)?.message ?? "";
  const nama = (error as Error)?.name ?? "";

  if (/cancel/i.test(pesan)) {
    return "Pemilihan printer dibatalkan. Tekan cetak lagi, lalu pilih printernya dari daftar.";
  }
  if (nama === "NotFoundError") {
    return "Printer tidak ditemukan. Pastikan printernya menyala dan Bluetooth-nya aktif.";
  }
  if (nama === "NetworkError" || /gatt|connect/i.test(pesan)) {
    return "Printer terputus. Biasanya karena kejauhan atau baterainya habis — dekatkan, lalu coba lagi.";
  }
  if (nama === "InvalidStateError" || /already in progress|busy/i.test(pesan)) {
    return "Printer masih mengerjakan cetakan sebelumnya. Tunggu sebentar, lalu coba lagi.";
  }
  if (nama === "SecurityError") {
    return "Peramban memblokir akses Bluetooth di halaman ini.";
  }
  return pesan || "Printer tidak merespons.";
}

/**
 * Menyambung, atau memakai sambungan yang memang masih hidup.
 *
 * Penyambungan ulang di sini tidak pernah memunculkan dialog: izin perangkatnya
 * sudah diberikan sebelumnya, dan yang dilakukan cuma membuka kembali jalurnya.
 */
export async function sambungPrinter(device: any) {
  if (device.gatt?.connected) return device.gatt;

  try {
    const server = await device.gatt?.connect();
    if (!server) throw new Error("Printer tidak dapat dihubungkan.");
    return server;
  } catch (error) {
    /**
     * Gagal MENYAMBUNG adalah satu-satunya tanda printernya benar-benar tidak
     * ada lagi — mati, kehabisan baterai, atau dibawa pergi. Baru di titik itu
     * printernya dilupakan, supaya percobaan berikutnya menawarkan memilih
     * ulang. Kegagalan menulis di tengah jalan TIDAK masuk hitungan; itu
     * biasanya cuma sambungan basi yang cukup dibuka lagi.
     */
    if (printerTersimpan === device) printerTersimpan = null;
    throw error;
  }
}

/**
 * Mengirim data ke printer, dengan satu kali percobaan ulang.
 *
 * Printer yang baru saja menganggur kadang memutus koneksinya tepat di tengah
 * pengiriman. Menyambung ulang lalu mengulang sekali jauh lebih baik daripada
 * memunculkan galat ke kasir yang sedang dilihat pembeli.
 */
export async function kirimKePrinter(device: any, payload: Uint8Array) {
  const tulis = async () => {
    const server = await sambungPrinter(device);
    const characteristic = await jalurTulisPrinter(server);
    for (let offset = 0; offset < payload.length; offset += 180) {
      const chunk = payload.slice(offset, offset + 180);
      if (typeof characteristic.writeValueWithoutResponse === "function") {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    }
  };

  // Seluruh pengiriman lewat satu antrean, tidak pernah dua sekaligus.
  return antre(async () => {
    try {
      await tulis();
    } catch (error) {
      console.warn("[KAEL] kiriman pertama gagal, menyambung ulang sekali", error);
      await tulis();
    }
  });
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
