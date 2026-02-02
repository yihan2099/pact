"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { HeroSection } from "@/components/landing/hero-section";
import { WhySection } from "@/components/landing/why-section";
import { RolesSection } from "@/components/landing/roles-section";
import { ArchitectureSection } from "@/components/landing/architecture-section";
import { FooterSection } from "@/components/landing/footer-section";

const FaultyTerminal = dynamic(() => import("@/components/FaultyTerminal"), {
  ssr: false,
});

// Stable grid multiplier arrays to prevent unnecessary re-renders
const GRID_MUL_MOBILE: [number, number] = [1, 1];
const GRID_MUL_DESKTOP: [number, number] = [2, 1];

function useResponsiveTerminalParams() {
  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef<number | null>(null);

  useEffect(() => {
    const updateParams = () => {
      const width = window.innerWidth;
      const newIsMobile = width < 768;

      // Only update if the mobile/desktop breakpoint actually crossed
      // This prevents re-renders from iOS address bar resize events
      if (lastWidthRef.current !== null) {
        const wasAlsoMobile = lastWidthRef.current < 768;
        if (wasAlsoMobile === newIsMobile) {
          lastWidthRef.current = width;
          return; // Same breakpoint, no need to update
        }
      }

      lastWidthRef.current = width;
      setIsMobile(newIsMobile);
    };

    updateParams();
    window.addEventListener("resize", updateParams);
    return () => window.removeEventListener("resize", updateParams);
  }, []);

  // Use stable array references that never change
  const params = useMemo(() => ({
    scale: isMobile ? 1.0 : 1.5,
    gridMul: isMobile ? GRID_MUL_MOBILE : GRID_MUL_DESKTOP,
    digitSize: isMobile ? 1.5 : 1.2,
  }), [isMobile]);

  return params;
}

export default function Home() {
  const { scale, gridMul, digitSize } = useResponsiveTerminalParams();

  return (
    <div className="relative min-h-screen min-h-[100dvh]">
      {/* Fixed terminal background - GPU accelerated to prevent scroll glitches */}
      <div
        className="fixed inset-0 bg-black"
        aria-hidden="true"
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <FaultyTerminal
          scale={scale}
          gridMul={gridMul}
          digitSize={digitSize}
          timeScale={0.5}
          pause={false}
          scanlineIntensity={0.5}
          glitchAmount={1}
          flickerAmount={1}
          noiseAmp={1}
          chromaticAberration={0}
          dither={0}
          curvature={0.1}
          tint="#A7EF9E"
          mouseReact
          mouseStrength={0.5}
          pageLoadAnimation
          brightness={0.6}
          className=""
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      {/* Scrollable content */}
      <main className="relative z-10">
        <HeroSection />
        <WhySection />
        <RolesSection />
        <ArchitectureSection />
        <FooterSection />
      </main>
    </div>
  );
}
