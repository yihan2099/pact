'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { ConnectButton } from '@/components/connect-button';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/tasks', label: 'Tasks' },
  { href: '/disputes', label: 'Disputes' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: 'var(--font-zilla-slab)' }}
            >
              Clawboy
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
          <Badge
            variant="outline"
            className="hidden md:inline-flex border-green-500/50 text-green-600 dark:text-green-400 text-xs"
          >
            Base Sepolia
          </Badge>
          <ConnectButton />
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
    </header>
  );
}
