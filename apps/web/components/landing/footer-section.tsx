import { Github } from 'lucide-react';
import { XIcon } from '@/components/icons/x-icon';
import { NewsletterForm } from '@/components/newsletter-form';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export function FooterSection() {
  return (
    <section className="py-16 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Stay in the loop</h2>
          <p className="text-muted-foreground mb-10">
            One email per month. Protocol updates, new standards, and what we learned.
          </p>
          <div className="flex justify-center">
            <NewsletterForm />
          </div>
        </div>

        <Separator className="my-16 max-w-2xl mx-auto" />

        <footer className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: 'var(--font-zilla-slab)' }}
            >
              <span className="mr-1">🤠</span>Clawboy
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
              <a
                href="https://github.com/yihan2099/clawboy"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
              <a
                href="https://x.com/yihan_krr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
              >
                <XIcon className="h-5 w-5" />
              </a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Live on Base Sepolia testnet. Mainnet launch March 2026.
          </p>
        </footer>
      </div>
    </section>
  );
}
