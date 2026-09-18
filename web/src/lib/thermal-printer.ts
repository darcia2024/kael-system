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

/** Profil layanan ESC/POS yang dipakai printer thermal 58mm dan 80mm di pasaran. */
export const LAYANAN_PRINTER = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standar 18F0
  "0000ffe0-0000-1000-8000-00805f9b34fb", // Feasycom / Panda / VSC / Eppos FFE0
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART NUS
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Microchip
  "0000ff00-0000-1000-8000-00805f9b34fb", // Xprinter / ZJiang FF00
  "0000ae30-0000-1000-8000-00805f9b34fb", // ZJiang AE30
  "0000fff0-0000-1000-8000-00805f9b34fb", // Custom FFF0
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Telink / Star
  "0000180a-0000-1000-8000-00805f9b34fb", // Device Information
];

/** Jalur tulis di dalam layanan di atas. */
export const KARAKTERISTIK_PRINTER = [
  "00002af1-0000-1000-8000-00805f9b34fb", // Standar 2AF1
  "0000ffe1-0000-1000-8000-00805f9b34fb", // Feasycom FFE1
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART RX
  "49535343-8841-43f4-a8d4-ecbe34729bb3", // ISSC TX
  "0000ff02-0000-1000-8000-00805f9b34fb", // Xprinter FF02
  "0000ae01-0000-1000-8000-00805f9b34fb", // ZJiang AE01
  "0000fff2-0000-1000-8000-00805f9b34fb", // Custom FFF2
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", // Telink TX
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

  /**
   * Jalur tulisnya ikut diperiksa. Inilah bagian yang selama ini gelap: kalau
   * karakteristik yang terpilih tidak punya sifat tulis, tulisan diterima tanpa
   * galat lalu hilang — printer diam, layar bilang terkirim.
   */
  let jalurTulis: Record<string, unknown> | string = "printer belum disambung";
  if (printerTersimpan) {
    try {
      const server = await sambungPrinter(printerTersimpan);
      const c = await jalurTulisPrinter(server);
      jalurTulis = {
        uuid: c.uuid,
        dikenal: KARAKTERISTIK_PRINTER.includes(c.uuid),
        bisaTulisDenganKonfirmasi: Boolean(c.properties?.write),
        bisaTulisTanpaKonfirmasi: Boolean(c.properties?.writeWithoutResponse),
      };
    } catch (error) {
      jalurTulis = `gagal: ${(error as Error).message}`;
    }
  }

  return {
    webBluetoothAda: true,
    izinPermanenTersedia,
    jumlahPerangkatTersimpan: tersimpan.length,
    namaPerangkatTersimpan: tersimpan.map((d) => d.name ?? "(tanpa nama)"),
    printerSedangDiingat: printerTersimpan?.name ?? null,
    printerSedangTersambung: Boolean(printerTersimpan?.gatt?.connected),
    jalurTulis,
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
        { namePrefix: "Bluetooth Printer" },
        { namePrefix: "Thermal" },
        { namePrefix: "PT-" },
        { namePrefix: "JP-" },
        { namePrefix: "XP-" },
        { namePrefix: "Panda" },
        { namePrefix: "VSC" },
        { namePrefix: "Eppos" },
        { namePrefix: "Iware" },
        { namePrefix: "Zywell" },
        { namePrefix: "ZJ-" },
        { namePrefix: "58" },
        { namePrefix: "80" },
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
    if (printerTersimpan === device) printerTersimpan = null;
    throw error;
  }
}

/**
 * Mengirim data ke printer, dengan satu kali percobaan ulang.
 */
export async function kirimKePrinter(device: any, payload: Uint8Array) {
  const tulis = async () => {
    const server = await sambungPrinter(device);
    const characteristic = await jalurTulisPrinter(server);
    const sifat = characteristic.properties ?? {};

    const besarPotongan = 20;
    const tulisSatu = async (b: Uint8Array) => {
      // Prioritaskan writeWithoutResponse jika didukung untuk mencegah freeze menunggu GATT ACK
      if (sifat.writeWithoutResponse && typeof characteristic.writeValueWithoutResponse === "function") {
        try {
          await characteristic.writeValueWithoutResponse(b);
          return;
        } catch {
          // fallback ke write dengan response jika gagal
        }
      }

      if (sifat.write && typeof characteristic.writeValueWithResponse === "function") {
        try {
          await characteristic.writeValueWithResponse(b);
          return;
        } catch {
          // fallback
        }
      }

      if (typeof characteristic.writeValue === "function") {
        try {
          await characteristic.writeValue(b);
          return;
        } catch {
          if (typeof characteristic.writeValueWithoutResponse === "function") {
            await characteristic.writeValueWithoutResponse(b);
            return;
          }
        }
      }

      if (typeof characteristic.writeValueWithoutResponse === "function") {
        await characteristic.writeValueWithoutResponse(b);
      }
    };

    for (let offset = 0; offset < payload.length; offset += besarPotongan) {
      await tulisSatu(payload.slice(offset, offset + besarPotongan));
      await new Promise((r) => setTimeout(r, 12));
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

/**
 * Mencari jalur tulis ESC/POS pada printer yang sudah tersambung.
 *
 * Versi sebelumnya mengambil karakteristik PERTAMA yang UUID-nya cocok, tanpa
 * memeriksa apakah benda itu memang bisa ditulisi. Karakteristik yang cuma bisa
 * dibaca atau memberi notifikasi tetap "ditemukan", tulisan ke sana diterima
 * tanpa galat, dan datanya hilang — printer diam, layar bilang terkirim, dan
 * tidak ada satu pun keterangan yang menyambungkan keduanya.
 *
 * Sekarang SELURUH layanan dan karakteristik ditelusuri, dan yang dipilih harus
 * benar-benar punya sifat tulis.
 */
export async function jalurTulisPrinter(server: any) {
  const layanan: any[] = [];

  // Layanan yang sudah dikenal didahulukan, lalu sisanya sebagai cadangan.
  for (const uuid of LAYANAN_PRINTER) {
    try {
      layanan.push(await server.getPrimaryService(uuid));
    } catch {
      /* printer ini memakai profil lain */
    }
  }
  try {
    for (const s of await server.getPrimaryServices()) {
      if (!layanan.some((sudah) => sudah.uuid === s.uuid)) layanan.push(s);
    }
  } catch {
    /* sebagian peramban menolak menelusuri semua layanan */
  }

  let cadangan: any = null;
  for (const service of layanan) {
    let daftar: any[] = [];
    try {
      daftar = await service.getCharacteristics();
    } catch {
      continue;
    }

    for (const c of daftar) {
      const sifat = c.properties ?? {};
      if (!sifat.write && !sifat.writeWithoutResponse) continue;

      // UUID yang sudah dikenal langsung dipakai; yang lain disimpan sebagai
      // cadangan kalau ternyata tidak ada yang cocok sama sekali.
      if (KARAKTERISTIK_PRINTER.includes(c.uuid)) return c;
      cadangan = cadangan ?? c;
    }
  }

  if (cadangan) {
    console.info("[KAEL] memakai jalur tulis tak dikenal:", cadangan.uuid);
    return cadangan;
  }
  throw new Error("Printer ini tidak punya jalur tulis yang bisa dipakai.");
}
