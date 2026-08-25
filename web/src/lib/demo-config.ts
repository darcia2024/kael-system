export interface DemoBrand {
  id: string;
  name: string;
  category: string;
  tagline: string;
  themeColor: string; // hex
  themeColorLight: string; // hex for backgrounds
  logoText: string;
  address: string;
  googleMapsUrl: string;
  tableCount: number;
}

export const DEMO_BRANDS: DemoBrand[] = [
  {
    id: "senja-coffee",
    name: "Senja Coffee & Eatery",
    category: "Coffee & Bakery",
    tagline: "Artisan Coffee & Fresh Pastry",
    themeColor: "#7958d8",
    themeColorLight: "#f0edff",
    logoText: "☕ SENJA",
    address: "Jl. Riau No. 42, Bandung",
    googleMapsUrl: "https://maps.google.com/?q=Senja+Coffee",
    tableCount: 15,
  },
  {
    id: "barber-king",
    name: "Barber King Studio",
    category: "Grooming & Barbershop",
    tagline: "Gentlemen Premium Haircut & Care",
    themeColor: "#0f766e",
    themeColorLight: "#ccfbf1",
    logoText: "✂️ KING",
    address: "Jl. Senopati No. 18, Jakarta Selatan",
    googleMapsUrl: "https://maps.google.com/?q=Barber+King",
    tableCount: 6,
  },
  {
    id: "bakso-nusantara",
    name: "Bakso & Resto Nusantara",
    category: "Restoran & Kuliner",
    tagline: "Resep Asli Warisan Nusantara",
    themeColor: "#c2410c",
    themeColorLight: "#ffedd5",
    logoText: "🍜 NUSANTARA",
    address: "Jl. Kaliurang Km 5.5, Yogyakarta",
    googleMapsUrl: "https://maps.google.com/?q=Bakso+Nusantara",
    tableCount: 20,
  },
];
