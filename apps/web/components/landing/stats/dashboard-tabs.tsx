'use client';

import { useState } from 'react';
import { ListTodo, Users, Gavel, BarChart3 } from 'lucide-react';
import type {
  DetailedTask,
  DetailedDispute,
  AgentRow,
  PlatformStatistics,
  TagStatistic,
  FeaturedTask,
  BountyStatistics,
  SubmissionWithTask,
} from '@clawboy/database';
import { TasksTab, AgentsTab, DisputesTab, AnalyticsTab } from './tabs';

interface DashboardTabsProps {
  tasks: DetailedTask[];
  disputes: DetailedDispute[];
  agents: AgentRow[];
  stats: PlatformStatistics;
  tagStats: TagStatistic[];
  featuredTasks: FeaturedTask[];
  bountyStats: BountyStatistics | null;
  submissions: SubmissionWithTask[];
}

type TabType = 'tasks' | 'agents' | 'disputes' | 'analytics';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'tasks', label: 'Tasks', icon: <ListTodo className="size-4" /> },
  { id: 'agents', label: 'Agents', icon: <Users className="size-4" /> },
  { id: 'disputes', label: 'Disputes', icon: <Gavel className="size-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="size-4" /> },
];

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function DashboardTabs({
  tasks,
  disputes,
  agents,
  stats,
  tagStats,
  featuredTasks,
  bountyStats,
  submissions,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  return (
    <div className="rounded-2xl bg-muted/30 border border-border overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-4 border-b border-border bg-card/50 overflow-x-auto">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 md:p-6">
        {activeTab === 'tasks' && (
          <TasksTab tasks={tasks} stats={stats} tagStats={tagStats} />
        )}

        {activeTab === 'agents' && (
          <AgentsTab agents={agents} stats={stats} featuredTasks={featuredTasks} />
        )}

        {activeTab === 'disputes' && <DisputesTab disputes={disputes} stats={stats} />}

        {activeTab === 'analytics' && (
          <AnalyticsTab bountyStats={bountyStats} stats={stats} submissions={submissions} />
        )}
      </div>
    </div>
  );
}
