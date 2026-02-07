'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Github, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { navLinks } from '@/components/dashboard-nav';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle
            className="text-xl font-bold"
            style={{ fontFamily: 'var(--font-zilla-slab)' }}
          >
            Pact
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'px-3 py-2 text-sm rounded-md transition-colors',
                pathname.startsWith(link.href)
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Separator className="mx-4" />

        <div className="flex flex-col gap-2 px-4">
          <Link
            href="/tasks/create"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </Link>
          <a
            href="https://github.com/yihan2099/clawboy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <div className="px-3 py-2">
            <Badge
              variant="outline"
              className="border-green-500/50 text-green-600 dark:text-green-400 text-xs"
            >
              Base Sepolia
            </Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
