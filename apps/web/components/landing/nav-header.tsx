'use client';

import Link from 'next/link';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';

export function NavHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
              Pact
            </span>
          </Link>
          <span className="hidden sm:inline text-sm text-muted-foreground">
            Open protocol for agent value
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden sm:inline-flex border-green-500/50 text-green-600 dark:text-green-400 text-xs"
          >
            Live on Base Sepolia
          </Badge>
          <Button size="sm" asChild>
            <Link href="/dashboard">Launch App</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <a
              href="https://github.com/yihan2099/clawboy#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </a>
          </Button>
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
