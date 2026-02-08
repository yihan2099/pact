'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  truncateAddress,
  getBaseScanUrl,
  formatTimeAgo,
  getStatusColor,
  formatStatus,
  formatBounty,
  getIpfsUrl,
} from '@/lib/format';
import {
  Trophy,
  Shield,
  ShieldAlert,
  Weight,
  ExternalLink,
  Clock,
  Wallet,
  ListTodo,
  Plus,
  Send,
} from 'lucide-react';
import {
  fetchAgentProfile,
  fetchMyCreatedTasks,
  fetchMySubmissions,
  fetchWonTasks,
} from './actions';

import type { Task, Submission, Agent } from '@/lib/types';

interface AgentProfile extends Agent {
  voteWeight: number;
}

export function DashboardContent() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'created';

  const setTab = (value: string) => {
    const params = new URLSearchParams({ tab: value });
    router.replace(`/dashboard?${params}`, { scroll: false });
  };
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [createdTotal, setCreatedTotal] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [wonTasks, setWonTasks] = useState<Task[]>([]);
  const [wonTotal, setWonTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const [profileResult, createdResult, submissionsResult, wonResult] = await Promise.all([
        fetchAgentProfile(addr),
        fetchMyCreatedTasks(addr),
        fetchMySubmissions(addr),
        fetchWonTasks(addr),
      ]);
      setAgent(profileResult);
      setCreatedTasks(createdResult.tasks as Task[]);
      setCreatedTotal(createdResult.total);
      setSubmissions(submissionsResult.submissions as Submission[]);
      setSubmissionsTotal(submissionsResult.total);
      setWonTasks(wonResult.tasks as Task[]);
      setWonTotal(wonResult.total);
    } catch {
      // Errors are non-fatal, just show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      loadData(address);
    } else {
      setLoading(false);
    }
  }, [isConnected, address, loadData]);

  if (!isConnected || !address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
            My Dashboard
          </h1>
        </div>
        <Card className="py-12">
          <CardContent className="text-center space-y-4">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Connect Your Wallet</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your wallet to view your dashboard, tasks, and submissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
            My Dashboard
          </h1>
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const reputation = agent ? parseInt(agent.reputation, 10) || 0 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
          My Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your tasks, submissions, and agent profile.
        </p>
      </div>

      {/* Profile Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{agent?.name || truncateAddress(address)}</h2>
              <a
                href={getBaseScanUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                {truncateAddress(address)}
                <ExternalLink className="h-3 w-3" />
              </a>
              {agent && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Joined {formatTimeAgo(agent.registered_at)}
                </div>
              )}
              {!agent && (
                <p className="text-xs text-muted-foreground">Not registered as an agent yet.</p>
              )}
            </div>
            {agent && (
              <Link href={`/agents/${address}`}>
                <Button variant="outline" size="sm">
                  View Profile
                </Button>
              </Link>
            )}
          </div>

          {agent && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Tasks Won:</span>
                <span className="font-semibold">{agent.tasks_won}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Disputes Won:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {agent.disputes_won}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Disputes Lost:</span>
                <span className="font-semibold text-red-500">{agent.disputes_lost}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Weight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Rep:</span>
                <span className="font-semibold">{reputation}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto flex">
          <TabsTrigger value="created" className="flex-1 sm:flex-initial text-xs sm:text-sm">Created ({createdTotal})</TabsTrigger>
          <TabsTrigger value="submissions" className="flex-1 sm:flex-initial text-xs sm:text-sm">Submissions ({submissionsTotal})</TabsTrigger>
          <TabsTrigger value="won" className="flex-1 sm:flex-initial text-xs sm:text-sm">Won ({wonTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-4">
          {createdTasks.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                You haven&apos;t created any tasks yet.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/tasks/create">
                  <Plus className="h-4 w-4 mr-1" />
                  Create your first task
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {createdTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.chain_task_id}`}>
                  <Card className="card-hover hover:border-primary/30 cursor-pointer py-3 mb-2">
                    <CardContent>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className={getStatusColor(task.status)}>
                            {formatStatus(task.status)}
                          </Badge>
                          <span className="text-sm font-medium line-clamp-1">
                            {task.title || `Task #${task.chain_task_id}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-sm">
                          <span className="font-semibold text-primary">
                            {formatBounty(task.bounty_amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(task.created_at)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          {submissions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Send className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                You haven&apos;t submitted any work yet.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/tasks">Browse open tasks</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub) => (
                <Card key={sub.id} className="card-hover hover:border-primary/30 py-3 mb-2">
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/tasks/${sub.task_id}`}
                          className="text-sm font-mono hover:text-primary transition-colors"
                        >
                          Task {sub.task_id.slice(0, 8)}...
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          #{sub.submission_index}
                        </span>
                        {sub.is_winner && (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            Winner
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <a
                          href={getIpfsUrl(sub.submission_cid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          IPFS <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(sub.submitted_at)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="won" className="mt-4">
          {wonTasks.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Trophy className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No won tasks yet. Keep submitting quality work!
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/tasks">Find tasks to work on</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {wonTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.chain_task_id}`}>
                  <Card className="card-hover hover:border-primary/30 cursor-pointer py-3 mb-2">
                    <CardContent>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            Won
                          </Badge>
                          <span className="text-sm font-medium line-clamp-1">
                            {task.title || `Task #${task.chain_task_id}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-sm">
                          <span className="font-semibold text-primary">
                            {formatBounty(task.bounty_amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(task.created_at)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
