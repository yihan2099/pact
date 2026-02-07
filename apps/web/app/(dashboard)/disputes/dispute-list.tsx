'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatTimeAgo, truncateAddress, formatBounty } from '@/lib/format';
import { ChevronLeft, ChevronRight, Scale, Clock } from 'lucide-react';

interface Dispute {
  id: string;
  chain_dispute_id: string;
  task_id: string;
  disputer_address: string;
  dispute_stake: string;
  voting_deadline: string;
  status: string;
  disputer_won: boolean | null;
  votes_for_disputer: string;
  votes_against_disputer: string;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

interface DisputeListProps {
  disputes: Dispute[];
  total: number;
  page: number;
  totalPages: number;
  currentStatus: string;
}

function getDisputeStatusColor(status: string, disputerWon: boolean | null) {
  if (status === 'active') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  if (status === 'resolved' && disputerWon)
    return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (status === 'resolved' && !disputerWon) return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

function getDisputeStatusLabel(status: string, disputerWon: boolean | null) {
  if (status === 'active') return 'Active';
  if (status === 'resolved' && disputerWon) return 'Disputer Won';
  if (status === 'resolved' && !disputerWon) return 'Disputer Lost';
  return status;
}

export function DisputeList({
  disputes,
  total,
  page,
  totalPages,
  currentStatus,
}: DisputeListProps) {
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
    router.push(`/disputes?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={currentStatus === opt.value ? 'default' : 'outline'}
            size="xs"
            onClick={() => updateParams({ status: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {total} dispute{total !== 1 ? 's' : ''} found
      </p>

      {disputes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No disputes found.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {disputes.map((dispute) => {
            const votesFor = parseInt(dispute.votes_for_disputer || '0');
            const votesAgainst = parseInt(dispute.votes_against_disputer || '0');
            const totalVotes = votesFor + votesAgainst;
            const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;

            return (
              <Link key={dispute.id} href={`/disputes/${dispute.chain_dispute_id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full py-4">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={getDisputeStatusColor(dispute.status, dispute.disputer_won)}
                      >
                        {getDisputeStatusLabel(dispute.status, dispute.disputer_won)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        #{dispute.chain_dispute_id}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-medium">Task #{dispute.task_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Disputer: {truncateAddress(dispute.disputer_address)}
                      </div>
                    </div>

                    {/* Vote Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-green-500">For: {votesFor}</span>
                        <span className="text-red-500">Against: {votesAgainst}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${forPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <span className="flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {formatBounty(dispute.dispute_stake)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dispute.status === 'active'
                          ? formatTimeAgo(dispute.voting_deadline)
                          : formatTimeAgo(dispute.created_at)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

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
