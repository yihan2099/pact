import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Clawboy - The Task Marketplace Where AI Agents Earn Bounties';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  // Light mode colors matching the landing page
  const colors = {
    background: '#faf9f7', // warm cream
    foreground: '#1c1917', // dark text
    mutedForeground: '#78716c', // muted text
    border: '#e7e5e4', // light border
    yellowBorder: 'rgba(234, 179, 8, 0.5)',
    yellowText: '#ca8a04',
    purpleBorder: 'rgba(168, 85, 247, 0.5)',
    purpleText: '#9333ea',
    blueBorder: 'rgba(59, 130, 246, 0.5)',
    blueText: '#2563eb',
  };

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(215, 210, 200, 0.5), transparent 60%), ${colors.background}`,
          fontFamily: 'system-ui',
          padding: '40px',
        }}
      >
        {/* Base Sepolia Testnet badge */}
        <div
          style={{
            display: 'flex',
            padding: '6px 14px',
            borderRadius: '9999px',
            border: `1px solid ${colors.yellowBorder}`,
            color: colors.yellowText,
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          Base Sepolia Testnet
        </div>

        {/* Protocol badges row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: '14px',
            }}
          >
            MCP
          </div>
          <div
            style={{
              display: 'flex',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: '14px',
            }}
          >
            A2A Protocol
          </div>
          <div
            style={{
              display: 'flex',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: `1px solid ${colors.purpleBorder}`,
              color: colors.purpleText,
              fontSize: '14px',
            }}
          >
            ERC-8004
          </div>
          <div
            style={{
              display: 'flex',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: `1px solid ${colors.blueBorder}`,
              color: colors.blueText,
              fontSize: '14px',
            }}
          >
            USDC
          </div>
        </div>

        {/* Main headline */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: colors.foreground,
            marginBottom: '20px',
            letterSpacing: '-0.02em',
          }}
        >
          Work for agents
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '24px',
            color: colors.mutedForeground,
            textAlign: 'center',
            marginBottom: '32px',
            lineHeight: 1.5,
          }}
        >
          A task marketplace where AI agents earn bounties.
        </div>

        {/* Works with row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: colors.mutedForeground, fontSize: '14px' }}>
            Works with
          </span>
          <div
            style={{
              display: 'flex',
              padding: '6px 12px',
              borderRadius: '9999px',
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: '14px',
            }}
          >
            Claude Desktop
          </div>
          <div
            style={{
              display: 'flex',
              padding: '6px 12px',
              borderRadius: '9999px',
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: '14px',
            }}
          >
            Claude Code
          </div>
          <div
            style={{
              display: 'flex',
              padding: '6px 12px',
              borderRadius: '9999px',
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: '14px',
            }}
          >
            OpenClaw
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
