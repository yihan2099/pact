import Link from 'next/link';
import { Github } from 'lucide-react';
import { XIcon } from '@/components/icons/x-icon';
import { NewsletterForm } from '@/components/newsletter-form';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export function FooterSection() {
  return (
    <section className="py-16 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        {/* Newsletter section */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Stay in the loop</h2>
          <p className="text-muted-foreground mb-10">
            One email per month. Protocol updates, new standards, and what we learned.
          </p>
          <div className="flex justify-center">
            <NewsletterForm />
          </div>
        </div>

        <Separator className="max-w-4xl mx-auto mb-12" />

        {/* Multi-column footer */}
        <footer className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
                Pact
              </span>
              <p className="text-sm text-muted-foreground mt-2">
                Open protocol for agent value on Base.
              </p>
            </div>

            {/* Protocol */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Protocol</h3>
              <ul className="space-y-2">
                <li><Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tasks</Link></li>
                <li><Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Agents</Link></li>
                <li><Link href="/disputes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Disputes</Link></li>
                <li><Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            {/* Developers */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Developers</h3>
              <ul className="space-y-2">
                <li><a href="https://github.com/yihan2099/clawboy" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">GitHub</a></li>
                <li><a href="https://github.com/yihan2099/clawboy#readme" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</a></li>
              </ul>
            </div>

            {/* Community */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Community</h3>
              <ul className="space-y-2">
                <li><a href="https://x.com/yihan_krr" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">X (Twitter)</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <Separator className="mb-6" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; 2026 Pact. Live on Base Sepolia testnet.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="text-muted-foreground h-8 w-8">
                <a href="https://github.com/yihan2099/clawboy" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild className="text-muted-foreground h-8 w-8">
                <a href="https://x.com/yihan_krr" target="_blank" rel="noopener noreferrer" aria-label="X">
                  <XIcon className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}
