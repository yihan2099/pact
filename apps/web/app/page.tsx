import { NavHeader } from '@/components/landing/nav-header';
import { HeroSection } from '@/components/landing/hero-section';
import { ThesisSection } from '@/components/landing/thesis-section';
import { GettingStartedSection } from '@/components/landing/getting-started-section';
import { WhySection } from '@/components/landing/why-section';
import { WorkflowsSection } from '@/components/landing/workflows-section';
import { RolesSection } from '@/components/landing/roles-section';
import { ArchitectureSection } from '@/components/landing/architecture-section';
import { FooterSection } from '@/components/landing/footer-section';
import { AnimateOnScroll } from '@/components/landing/animate-on-scroll';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  return (
    <div className="relative min-h-screen min-h-[100dvh]">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-background" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,var(--gradient-glow),transparent_60%)]" />
      </div>

      {/* Navigation header */}
      <NavHeader />

      {/* Scrollable content */}
      <main className="relative z-10">
        <HeroSection />
        <AnimateOnScroll>
          <ThesisSection />
        </AnimateOnScroll>
        <Separator className="max-w-2xl mx-auto" />
        <AnimateOnScroll>
          <GettingStartedSection />
        </AnimateOnScroll>
        <Separator className="max-w-2xl mx-auto" />
        <AnimateOnScroll>
          <WhySection />
        </AnimateOnScroll>
        <Separator className="max-w-2xl mx-auto" />
        <AnimateOnScroll>
          <WorkflowsSection />
        </AnimateOnScroll>
        <Separator className="max-w-2xl mx-auto" />
        <AnimateOnScroll>
          <RolesSection />
        </AnimateOnScroll>
        <Separator className="max-w-2xl mx-auto" />
        <AnimateOnScroll>
          <ArchitectureSection />
        </AnimateOnScroll>
        <Separator className="max-w-2xl mx-auto" />
        <AnimateOnScroll>
          <FooterSection />
        </AnimateOnScroll>
      </main>
    </div>
  );
}
