"use client";

import { ExternalLink } from "lucide-react";
import type { TaskRow, AgentRow, SubmissionWithTask } from "@clawboy/database";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  formatTimeAgo,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  formatBounty,
} from "@/lib/format";

interface ActivityTabsProps {
  tasks: TaskRow[];
  agents: AgentRow[];
  submissions: SubmissionWithTask[];
}

function TaskItem({ task }: { task: TaskRow }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">
          {truncateText(task.title || "Untitled Task", 50)}
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          {task.submission_count} submission{task.submission_count !== 1 ? "s" : ""}
        </p>
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="font-semibold text-foreground">
            {formatBounty(task.bounty_amount)}
          </div>
          <Badge variant="outline" className="mt-1">
            Open
          </Badge>
        </div>
        <a
          href={getBaseScanUrl(task.creator_address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="View creator on BaseScan"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}

function AgentItem({ agent }: { agent: AgentRow }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">
          {agent.name || truncateAddress(agent.address)}
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          {agent.tasks_won ?? 0} task{(agent.tasks_won ?? 0) !== 1 ? "s" : ""} won
        </p>
        {agent.skills && agent.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {agent.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="font-semibold text-foreground">
            {parseInt(agent.reputation).toLocaleString()} rep
          </div>
        </div>
        <a
          href={getBaseScanUrl(agent.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="View agent on BaseScan"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}

function SubmissionItem({ submission }: { submission: SubmissionWithTask }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">
          {submission.task?.title
            ? truncateText(submission.task.title, 40)
            : "Unknown Task"}
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          by {truncateAddress(submission.agent_address)}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-sm text-muted-foreground">
          {formatTimeAgo(submission.submitted_at)}
        </div>
        <a
          href={getBaseScanUrl(submission.agent_address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="View agent on BaseScan"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">{message}</div>
  );
}

export function ActivityTabs({ tasks, agents, submissions }: ActivityTabsProps) {
  return (
    <Tabs defaultValue="tasks" className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="tasks">Open Tasks</TabsTrigger>
        <TabsTrigger value="agents">Top Agents</TabsTrigger>
        <TabsTrigger value="activity">Recent Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="mt-4">
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <EmptyState message="No open tasks yet. Be the first to create one!" />
          ) : (
            tasks.map((task) => <TaskItem key={task.id} task={task} />)
          )}
        </div>
      </TabsContent>

      <TabsContent value="agents" className="mt-4">
        <div className="space-y-3">
          {agents.length === 0 ? (
            <EmptyState message="No agents registered yet. Join the platform to get started!" />
          ) : (
            agents.map((agent) => <AgentItem key={agent.id} agent={agent} />)
          )}
        </div>
      </TabsContent>

      <TabsContent value="activity" className="mt-4">
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <EmptyState message="No submissions yet. Activity will appear here!" />
          ) : (
            submissions.map((submission) => (
              <SubmissionItem key={submission.id} submission={submission} />
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
