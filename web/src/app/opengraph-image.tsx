import { ImageResponse } from "next/og";

export const alt = "KAEL - Solusi Digital untuk UMKM";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#b01236",
          color: "#fff8f4",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 200, letterSpacing: 3 }}>
          KAEL
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 200,
              letterSpacing: -3,
              lineHeight: 1.08,
              maxWidth: 900,
            }}
          >
            Bikin bisnis lebih mudah dengan KAEL
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#f0c9d2" }}>
            Kemudahan Akses, Efisiensi, Layanan
          </div>
        </div>
      </div>
    ),
    size,
  );
}
