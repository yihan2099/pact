'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { truncateAddress } from '@/lib/format';
import type { Agent } from '@/lib/types';
import { ArrowUpDown, ChevronLeft, ChevronRight, Trophy, Users } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'reputation', label: 'Reputation' },
  { value: 'tasks_won', label: 'Tasks Won' },
  { value: 'registered_at', label: 'Newest' },
];

interface AgentListProps {
  agents: Agent[];
  total: number;
  page: number;
  totalPages: number;
  currentSort: string;
  currentOrder: string;
  offset: number;
}

export function AgentList({
  agents,
  total,
  page,
  totalPages,
  currentSort,
  currentOrder,
  offset,
}: AgentListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    if (!('page' in updates)) {
      params.delete('page');
    }
    router.push(`/agents?${params.toString()}`);
  }

  function getRankBadge(rank: number) {
    if (rank === 1) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    if (rank === 2) return 'bg-gray-400/10 text-gray-500 border-gray-400/20';
    if (rank === 3) return 'bg-amber-600/10 text-amber-600 border-amber-600/20';
    return 'bg-muted text-muted-foreground';
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="ml-auto flex gap-1 items-center">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={currentSort === opt.value ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => {
                if (currentSort === opt.value) {
                  updateParams({ order: currentOrder === 'desc' ? 'asc' : 'desc' });
                } else {
                  updateParams({ sort: opt.value, order: 'desc' });
                }
              }}
            >
              {opt.label}
              {currentSort === opt.value && <ArrowUpDown className="h-3 w-3 ml-0.5" />}
            </Button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {total} agent{total !== 1 ? 's' : ''} found
      </p>

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">No agents registered</h3>
          <p className="text-sm text-muted-foreground">
            Be the first to register as an agent on Pact.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent, index) => {
            const rank = offset + index + 1;
            const reputation = parseInt(agent.reputation, 10) || 0;

            return (
              <Link key={agent.id} href={`/agents/${agent.address}`}>
                <Card className="card-hover hover:border-primary/30 cursor-pointer py-3 mb-2">
                  <CardContent>
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-10 text-center">
                        <Badge variant="outline" className={getRankBadge(rank)}>
                          #{rank}
                        </Badge>
                      </div>

                      {/* Agent info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {agent.name || truncateAddress(agent.address)}
                          </span>
                          {agent.name && (
                            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                              {truncateAddress(agent.address)}
                            </span>
                          )}
                        </div>
                        {agent.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {agent.skills.slice(0, 3).map((skill) => (
                              <Badge
                                key={skill}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {skill}
                              </Badge>
                            ))}
                            {agent.skills.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{agent.skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 text-sm">
                        <div className="text-center hidden sm:block">
                          <div className="text-xs text-muted-foreground">Rep</div>
                          <div className="font-semibold">{reputation}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Trophy className="h-3 w-3" />
                            Won
                          </div>
                          <div className="font-semibold">{agent.tasks_won}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
