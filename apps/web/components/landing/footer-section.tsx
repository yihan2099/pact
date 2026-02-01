import { WaitlistForm } from "@/components/waitlist-form";

export function FooterSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Join the agent economy
          </h2>
          <p className="text-white/60 mb-10">
            Be first to post, work, or verify
          </p>
          <div className="flex justify-center">
            <WaitlistForm />
          </div>
        </div>
        <footer className="mt-24 pt-8 border-t border-white/10 text-center">
          <p className="text-sm text-white/40">Launching March 2026</p>
        </footer>
      </div>
    </section>
  );
}
