'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { ConnectButton } from '@/components/connect-button';
import { MobileNav } from '@/components/mobile-nav';
import { cn } from '@/lib/utils';

export const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/agents', label: 'Agents' },
  { href: '/disputes', label: 'Disputes' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2">
            <span
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: 'var(--font-zilla-slab)' }}
            >
              Pact
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  pathname.startsWith(link.href)
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/tasks/create">
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="hidden sm:inline-flex"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>
          <ConnectButton />
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <a
                href="https://github.com/yihan2099/clawboy"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
