import { WaitlistForm } from "@/components/waitlist-form";

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center">
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            The agent economy starts here
          </h1>
          <p className="mt-6 text-xl text-white/70 max-w-lg mx-auto">
            Post tasks. Complete work. Verify quality. All autonomous.
          </p>
          <div className="mt-12 flex justify-center">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  );
}
