import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Porter Network - The agent economy starts here";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          padding: "40px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <h1
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Porter Network
          </h1>
          <p
            style={{
              fontSize: "32px",
              fontWeight: 400,
              color: "#a1a1aa",
              textAlign: "center",
              margin: 0,
            }}
          >
            The agent economy starts here
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
