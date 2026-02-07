import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDisputeByChainId, getDisputeVotes, getTaskById } from '@clawboy/database/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTimeAgo, truncateAddress, getBaseScanUrl, formatBounty } from '@/lib/format';
import { ArrowLeft, ExternalLink, Scale } from 'lucide-react';
import Link from 'next/link';
import { VoteActions } from './vote-actions';
import { CountdownTimer } from '../../tasks/[id]/countdown-timer';

interface DisputeDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DisputeDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Dispute #${id}` };
}

export default async function DisputeDetailPage({ params }: DisputeDetailPageProps) {
  const { id } = await params;
  const dispute = await getDisputeByChainId(id);

  if (!dispute) {
    notFound();
  }

  const [votes, task] = await Promise.all([
    getDisputeVotes(dispute.id),
    getTaskById(dispute.task_id).catch(() => null),
  ]);

  const votesFor = parseInt(dispute.votes_for_disputer || '0');
  const votesAgainst = parseInt(dispute.votes_against_disputer || '0');
  const totalVotes = votesFor + votesAgainst;
  const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/disputes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Disputes
      </Link>

      {/* Dispute Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  dispute.status === 'active'
                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    : dispute.disputer_won
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                }
              >
                {dispute.status === 'active'
                  ? 'Active'
                  : dispute.disputer_won
                    ? 'Disputer Won'
                    : 'Disputer Lost'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Dispute #{dispute.chain_dispute_id}
              </span>
            </div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
              Dispute #{dispute.chain_dispute_id}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary flex items-center gap-1">
              <Scale className="h-5 w-5" />
              {formatBounty(dispute.dispute_stake)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Stake</div>
          </div>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Disputer</div>
            <a
              href={getBaseScanUrl(dispute.disputer_address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {truncateAddress(dispute.disputer_address)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Related Task</div>
            {task ? (
              <Link
                href={`/tasks/${task.chain_task_id}`}
                className="text-sm hover:text-primary transition-colors"
              >
                {task.title || `Task #${task.chain_task_id}`}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">
                Task #{dispute.task_id.slice(0, 8)}
              </span>
            )}
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Created</div>
            <div className="text-sm">{formatTimeAgo(dispute.created_at)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Voting Deadline Countdown */}
      {dispute.status === 'active' && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 py-4">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Voting Deadline</div>
                <div className="text-xs text-muted-foreground">
                  Cast your vote before the deadline expires.
                </div>
              </div>
              <CountdownTimer deadline={dispute.voting_deadline} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vote Tally */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vote Tally</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-500 font-medium">For Disputer: {votesFor}</span>
              <span className="text-red-500 font-medium">Against: {votesAgainst}</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${forPercent}%` }}
              />
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {totalVotes} total vote weight
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vote Actions */}
      {dispute.status === 'active' && (
        <VoteActions
          chainDisputeId={dispute.chain_dispute_id}
          disputerAddress={dispute.disputer_address}
        />
      )}

      {/* Individual Votes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Votes ({votes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {votes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No votes cast yet.</p>
          ) : (
            <div className="space-y-2">
              {votes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        vote.supports_disputer ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <a
                      href={getBaseScanUrl(vote.voter_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      {truncateAddress(vote.voter_address)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Weight: {vote.vote_weight}</span>
                    <span>{formatTimeAgo(vote.voted_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
