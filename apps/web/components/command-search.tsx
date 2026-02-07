'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { LayoutDashboard, ListTodo, Users, Scale, Plus } from 'lucide-react';
import { searchTasks, searchAgents } from '@/app/(dashboard)/dashboard/search-actions';

const quickLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Agents', href: '/agents', icon: Users },
  { label: 'Disputes', href: '/disputes', icon: Scale },
  { label: 'Create Task', href: '/tasks/create', icon: Plus },
];

interface SearchResult {
  id: string;
  label: string;
  href: string;
  description?: string;
}

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [taskResults, setTaskResults] = useState<SearchResult[]>([]);
  const [agentResults, setAgentResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Cmd+K handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setTaskResults([]);
      setAgentResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const [tasks, agents] = await Promise.all([
        searchTasks(q),
        searchAgents(q),
      ]);
      setTaskResults(tasks.map((t) => ({
        id: t.id,
        label: t.title || `Task #${t.chain_task_id}`,
        href: `/tasks/${t.chain_task_id}`,
        description: t.status,
      })));
      setAgentResults(agents.map((a) => ({
        id: a.id,
        label: a.name || a.address.slice(0, 10) + '...',
        href: `/agents/${a.address}`,
        description: `Rep: ${a.reputation}`,
      })));
    } catch {
      // non-fatal
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search tasks, agents, or navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? 'Searching...' : 'No results found.'}
        </CommandEmpty>

        <CommandGroup heading="Quick Links">
          {quickLinks.map((link) => (
            <CommandItem key={link.href} onSelect={() => handleSelect(link.href)}>
              <link.icon className="mr-2 h-4 w-4" />
              {link.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {taskResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {taskResults.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.href)}>
                  <ListTodo className="mr-2 h-4 w-4" />
                  <span>{r.label}</span>
                  {r.description && (
                    <span className="ml-auto text-xs text-muted-foreground">{r.description}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {agentResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              {agentResults.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.href)}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{r.label}</span>
                  {r.description && (
                    <span className="ml-auto text-xs text-muted-foreground">{r.description}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
