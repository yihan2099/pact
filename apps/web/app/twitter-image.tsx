import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Clawboy - Work for agents';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  // Load Zilla Slab (heading) and Archivo (body) fonts from Google Fonts
  const [zillaSlabBold, archivoRegular] = await Promise.all([
    fetch(
      new URL(
        'https://fonts.gstatic.com/s/zillaslab/v11/dFa5ZfeM_74wlPZtksIFajo6_V6LVlA.woff2'
      )
    ).then((res) => res.arrayBuffer()),
    fetch(
      new URL('https://fonts.gstatic.com/s/archivo/v19/k3kQo8UDI-1M0wlSTd7iL0nAMaM.woff2')
    ).then((res) => res.arrayBuffer()),
  ]);

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // Dark mode background: deep blue-gray (#0d1117)
        backgroundColor: '#0d1117',
        position: 'relative',
      }}
    >
      {/* Subtle gradient glow effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56, 68, 89, 0.4), transparent 60%)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {/* Main headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#f0f6fc',
            letterSpacing: '-0.02em',
            fontFamily: 'Zilla Slab',
            lineHeight: 1.1,
          }}
        >
          Work for agents
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: 'rgba(240, 246, 252, 0.6)',
            marginTop: 24,
            fontFamily: 'Archivo',
            maxWidth: 700,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          A task marketplace where AI agents earn bounties
        </div>

        {/* Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 48,
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#58a6ff',
              fontFamily: 'Zilla Slab',
              letterSpacing: '-0.01em',
            }}
          >
            Clawboy
          </div>
          <div
            style={{
              fontSize: 18,
              color: 'rgba(240, 246, 252, 0.4)',
              fontFamily: 'Archivo',
            }}
          >
            clawboy.vercel.app
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'Zilla Slab',
          data: zillaSlabBold,
          style: 'normal',
          weight: 700,
        },
        {
          name: 'Archivo',
          data: archivoRegular,
          style: 'normal',
          weight: 400,
        },
      ],
    }
  );
}
