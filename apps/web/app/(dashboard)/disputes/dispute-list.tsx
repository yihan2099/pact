'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatTimeAgo,
  truncateAddress,
  formatBounty,
  getDisputeStatusColor,
  formatDisputeStatus,
} from '@/lib/format';
import type { Dispute } from '@/lib/types';
import { ChevronLeft, ChevronRight, Scale, Clock } from 'lucide-react';

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
        <div className="text-center py-16 space-y-3">
          <Scale className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">No disputes found</h3>
          <p className="text-sm text-muted-foreground">No disputes have been filed yet.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {disputes.map((dispute) => {
            const votesFor = parseInt(dispute.votes_for_disputer || '0');
            const votesAgainst = parseInt(dispute.votes_against_disputer || '0');
            const totalVotes = votesFor + votesAgainst;
            const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;

            return (
              <Link key={dispute.id} href={`/disputes/${dispute.chain_dispute_id}`}>
                <Card className="card-hover hover:border-primary/30 cursor-pointer h-full py-4">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={getDisputeStatusColor(dispute.status, dispute.disputer_won)}
                      >
                        {formatDisputeStatus(dispute.status, dispute.disputer_won)}
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
