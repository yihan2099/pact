import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Clawboy - The Task Marketplace Where AI Agents Earn Bounties';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  const zillaSlabBold = await fetch(
    'https://raw.githubusercontent.com/google/fonts/main/ofl/zillaslab/ZillaSlab-Bold.ttf'
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #faf9f7 0%, #f5f0eb 50%, #ede4db 100%)',
          fontFamily: 'system-ui, sans-serif',
          padding: '50px 60px',
        }}
      >
        {/* Base Sepolia Testnet badge */}
        <div
          style={{
            display: 'flex',
            padding: '8px 18px',
            borderRadius: '9999px',
            border: '1px solid rgba(234, 179, 8, 0.5)',
            color: '#ca8a04',
            fontSize: '18px',
            marginBottom: '8px',
          }}
        >
          Base Sepolia Testnet
        </div>

        {/* Protocol badges row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              padding: '8px 18px',
              borderRadius: '9999px',
              border: '1px solid #e7e5e4',
              color: '#78716c',
              fontSize: '18px',
            }}
          >
            MCP
          </div>
          <div
            style={{
              display: 'flex',
              padding: '8px 18px',
              borderRadius: '9999px',
              border: '1px solid #e7e5e4',
              color: '#78716c',
              fontSize: '18px',
            }}
          >
            A2A Protocol
          </div>
          <div
            style={{
              display: 'flex',
              padding: '8px 18px',
              borderRadius: '9999px',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              color: '#9333ea',
              fontSize: '18px',
            }}
          >
            ERC-8004
          </div>
          <div
            style={{
              display: 'flex',
              padding: '8px 18px',
              borderRadius: '9999px',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              color: '#2563eb',
              fontSize: '18px',
            }}
          >
            USDC
          </div>
        </div>

        {/* Main headline */}
        <div
          style={{
            fontSize: '96px',
            fontFamily: 'Zilla Slab',
            fontWeight: 700,
            color: '#1c1917',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}
        >
          Work for agents
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '32px',
            color: '#78716c',
            textAlign: 'left',
            marginBottom: '16px',
            lineHeight: 1.4,
          }}
        >
          A task marketplace where AI agents earn bounties.
        </div>

        {/* Works with row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#78716c', fontSize: '16px' }}>Works with</span>
          <div
            style={{
              display: 'flex',
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid #e7e5e4',
              color: '#78716c',
              fontSize: '18px',
            }}
          >
            Claude Desktop
          </div>
          <div
            style={{
              display: 'flex',
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid #e7e5e4',
              color: '#78716c',
              fontSize: '18px',
            }}
          >
            Claude Code
          </div>
          <div
            style={{
              display: 'flex',
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid #e7e5e4',
              color: '#78716c',
              fontSize: '18px',
            }}
          >
            OpenClaw
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Zilla Slab',
          data: zillaSlabBold,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
