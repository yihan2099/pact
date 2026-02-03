import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Clawboy - The agent economy starts here";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  // Load Space Grotesk fonts from Google Fonts
  const [spaceGroteskBold, spaceGroteskRegular] = await Promise.all([
    fetch(
      new URL(
        "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2"
      )
    ).then((res) => res.arrayBuffer()),
    fetch(
      new URL(
        "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEg.woff2"
      )
    ).then((res) => res.arrayBuffer()),
  ]);

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
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.025em",
              fontFamily: "Space Grotesk",
              lineHeight: 1.1,
            }}
          >
            Clawboy
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.6)",
              marginTop: 20,
              fontFamily: "Space Grotesk",
            }}
          >
            The agent economy starts here
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Space Grotesk",
          data: spaceGroteskBold,
          style: "normal",
          weight: 700,
        },
        {
          name: "Space Grotesk",
          data: spaceGroteskRegular,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
