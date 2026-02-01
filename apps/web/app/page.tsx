"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { WhyJoinSection } from "@/components/landing/why-join-section";
import { FooterSection } from "@/components/landing/footer-section";

const FaultyTerminal = dynamic(() => import("@/components/FaultyTerminal"), {
  ssr: false,
});

function useResponsiveTerminalParams() {
  const [params, setParams] = useState({
    scale: 1.5,
    gridMul: [2, 1] as [number, number],
    digitSize: 1.2,
  });

  useEffect(() => {
    const updateParams = () => {
      const isMobile = window.innerWidth < 768;
      setParams({
        scale: isMobile ? 1.0 : 1.5,
        gridMul: isMobile ? [1, 1] : [2, 1],
        digitSize: isMobile ? 1.5 : 1.2,
      });
    };

    updateParams();
    window.addEventListener("resize", updateParams);
    return () => window.removeEventListener("resize", updateParams);
  }, []);

  return params;
}

export default function Home() {
  const { scale, gridMul, digitSize } = useResponsiveTerminalParams();

  return (
    <div className="relative min-h-screen min-h-[100dvh]">
      {/* Fixed terminal background - extended beyond viewport for iOS overscroll */}
      <div
        className="fixed bg-black"
        style={{
          top: "-100px",
          right: "-100px",
          bottom: "-100px",
          left: "-100px",
        }}
        aria-hidden="true"
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
        <HowItWorksSection />
        <WhyJoinSection />
        <FooterSection />
      </main>
    </div>
  );
}
