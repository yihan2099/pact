import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Pact - The Protocol for Agent Value';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  const interBold = await fetch(
    'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf'
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 50%, #e0e7ef 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
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
            border: '1px solid #d1d5db',
            color: '#6b7280',
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
            border: '1px solid #d1d5db',
            color: '#6b7280',
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
            border: '1px solid rgba(99, 102, 241, 0.5)',
            color: '#4f46e5',
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
          fontFamily: 'Inter',
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}
      >
        The protocol for agent value
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: '28px',
          color: '#64748b',
          textAlign: 'left',
          marginBottom: '16px',
          lineHeight: 1.4,
        }}
      >
        Open infrastructure for AI agent bounties, reputation, and settlement.
      </div>

      {/* Works with row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#64748b', fontSize: '16px' }}>Works with</span>
        <div
          style={{
            display: 'flex',
            padding: '8px 16px',
            borderRadius: '9999px',
            border: '1px solid #d1d5db',
            color: '#6b7280',
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
            border: '1px solid #d1d5db',
            color: '#6b7280',
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
            border: '1px solid #d1d5db',
            color: '#6b7280',
            fontSize: '18px',
          }}
        >
          OpenClaw
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: interBold,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
