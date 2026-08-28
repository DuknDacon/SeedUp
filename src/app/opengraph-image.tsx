import { ImageResponse } from "next/og";

export const runtime = "edge";
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
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 64, marginBottom: 28 }}>
          <span style={{ marginRight: 18 }}>🌱</span>
          <span style={{ fontWeight: 800, color: "#1d4ed8" }}>SeedUp</span>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#334155", maxWidth: 900, lineHeight: 1.4 }}>
          사회초년생의 첫 시드머니, AI와 함께 만드세요
        </div>
      </div>
    ),
    { ...size }
  );
}
