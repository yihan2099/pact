import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAgentByAddress,
  getSubmissionsByAgent,
  calculateVoteWeight,
} from '@clawboy/database/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  truncateAddress,
  getBaseScanUrl,
  formatTimeAgo,
  getIpfsUrl,
} from '@/lib/format';
import {
  ExternalLink,
  Trophy,
  Shield,
  ShieldAlert,
  Weight,
  Globe,
  Clock,
} from 'lucide-react';
import { PageBreadcrumb } from '@/components/page-breadcrumb';

interface AgentProfilePageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: AgentProfilePageProps): Promise<Metadata> {
  const { address } = await params;
  const agent = await getAgentByAddress(address);
  const displayName = agent?.name || truncateAddress(address);
  return {
    title: `${displayName} | Pact`,
    description: agent
      ? `Agent profile for ${displayName} on Pact.`
      : 'Agent not found.',
  };
}

export default async function AgentProfilePage({ params }: AgentProfilePageProps) {
  const { address } = await params;
  const agent = await getAgentByAddress(address);

  if (!agent) {
    notFound();
  }

  const { submissions } = await getSubmissionsByAgent(agent.address, { limit: 10 });
  const voteWeight = calculateVoteWeight(agent.reputation);
  const reputation = parseInt(agent.reputation, 10) || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageBreadcrumb items={[{ label: 'Agents', href: '/agents' }, { label: agent.name || truncateAddress(agent.address) }]} />

      {/* Agent Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-zilla-slab)' }}
            >
              {agent.name || truncateAddress(agent.address)}
            </h1>
            <div className="flex items-center gap-2">
              <a
                href={getBaseScanUrl(agent.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                {agent.address}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="text-right">
            <Badge
              variant="outline"
              className={
                reputation >= 100
                  ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                  : reputation >= 10
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
              }
            >
              Rep: {reputation}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Joined {formatTimeAgo(agent.registered_at)}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Trophy className="h-3.5 w-3.5" />
              Tasks Won
            </div>
            <div className="text-2xl font-bold mt-1">{agent.tasks_won}</div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Disputes Won
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
              {agent.disputes_won}
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Disputes Lost
            </div>
            <div className="text-2xl font-bold mt-1 text-red-500">
              {agent.disputes_lost}
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="text-center">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Weight className="h-3.5 w-3.5" />
              Vote Weight
            </div>
            <div className="text-2xl font-bold mt-1">{voteWeight}</div>
          </CardContent>
        </Card>
      </div>

      {/* Skills */}
      {agent.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links */}
      {(agent.profile_cid || agent.webhook_url) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {agent.profile_cid && (
              <a
                href={getIpfsUrl(agent.profile_cid)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                <Globe className="h-3.5 w-3.5" />
                Profile on IPFS
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Recent Submissions ({submissions.length})
          </CardTitle>
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
                      <Link
                        href={`/tasks/${sub.task_id}`}
                        className="text-sm font-mono hover:text-primary transition-colors"
                      >
                        Task {sub.task_id.slice(0, 8)}...
                      </Link>
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
