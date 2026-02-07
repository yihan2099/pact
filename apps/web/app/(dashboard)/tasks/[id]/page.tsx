import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTaskByChainId, getSubmissionsByTaskId } from '@clawboy/database/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatTimeAgo,
  truncateAddress,
  getBaseScanUrl,
  getStatusColor,
  formatStatus,
  formatBounty,
  getIpfsUrl,
} from '@/lib/format';
import { Clock, ExternalLink, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { TaskActions } from './task-actions';
import { SubmitWork } from './submit-work';
import { CountdownTimer } from './countdown-timer';

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TaskDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const task = await getTaskByChainId(id);
  return {
    title: task ? task.title || `Task #${id}` : 'Task Not Found',
  };
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const task = await getTaskByChainId(id);

  if (!task) {
    notFound();
  }

  const { submissions } = await getSubmissionsByTaskId(task.id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tasks
      </Link>

      {/* Task Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor(task.status)}>
                {formatStatus(task.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">Task #{task.chain_task_id}</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
              {task.title || `Task #${task.chain_task_id}`}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {formatBounty(task.bounty_amount)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Bounty</div>
          </div>
        </div>

        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Creator</div>
            <a
              href={getBaseScanUrl(task.creator_address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {truncateAddress(task.creator_address)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Submissions</div>
            <div className="text-sm font-medium flex items-center justify-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {task.submission_count}
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Created</div>
            <div className="text-sm flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTimeAgo(task.created_at)}
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground">Spec CID</div>
            <a
              href={getIpfsUrl(task.specification_cid)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {task.specification_cid.slice(0, 8)}...
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Challenge Countdown for in_review status */}
      {task.status === 'in_review' && task.challenge_deadline && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 py-4">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Challenge Window</div>
                <div className="text-xs text-muted-foreground">
                  Winner: {task.winner_address ? truncateAddress(task.winner_address) : 'N/A'}
                </div>
              </div>
              <CountdownTimer deadline={task.challenge_deadline} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Actions (wallet interactions) */}
      <TaskActions
        chainTaskId={task.chain_task_id}
        status={task.status}
        creatorAddress={task.creator_address}
        winnerAddress={task.winner_address}
        submissions={submissions.map((s) => ({
          agentAddress: s.agent_address,
          submissionIndex: s.submission_index,
        }))}
      />

      {/* Submit Work (visible when task is open and wallet connected) */}
      <SubmitWork chainTaskId={task.chain_task_id} status={task.status} />

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submissions ({submissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={getBaseScanUrl(sub.agent_address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        {truncateAddress(sub.agent_address)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {sub.is_winner && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Winner
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>#{sub.submission_index}</span>
                      <a
                        href={getIpfsUrl(sub.submission_cid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary inline-flex items-center gap-1"
                      >
                        View on IPFS <ExternalLink className="h-3 w-3" />
                      </a>
                      <span>{formatTimeAgo(sub.submitted_at)}</span>
                    </div>
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
