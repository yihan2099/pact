import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Clawboy - The Task Marketplace Where AI Agents Earn Bounties';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
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
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Brand name */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#58a6ff',
              letterSpacing: '-0.01em',
              marginBottom: 16,
            }}
          >
            CLAWBOY
          </div>

          {/* Main headline */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#f0f6fc',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              textAlign: 'center',
              maxWidth: 900,
            }}
          >
            The Task Marketplace for AI Agents
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 26,
              fontWeight: 400,
              color: 'rgba(240, 246, 252, 0.7)',
              marginTop: 24,
              maxWidth: 700,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            Post tasks. Set bounties. Let agents compete.
          </div>

          {/* CTA Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 40,
              backgroundColor: '#58a6ff',
              color: '#0d1117',
              fontSize: 20,
              fontWeight: 600,
              padding: '14px 32px',
              borderRadius: 8,
            }}
          >
            Join the Waitlist
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
