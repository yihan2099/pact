import { formatEther } from "viem";
import { getCachedPlatformStatistics } from "@/app/actions/statistics";

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="text-center p-6 rounded-2xl bg-card backdrop-blur-sm border border-border">
      <div className="text-3xl md:text-4xl font-bold text-foreground">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function formatBounty(weiString: string): string {
  const eth = formatEther(BigInt(weiString));
  const num = parseFloat(eth);
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k ETH`;
  }
  if (num >= 1) {
    return `${num.toFixed(2)} ETH`;
  }
  if (num > 0) {
    return `${num.toFixed(4)} ETH`;
  }
  return "0 ETH";
}

function formatNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString();
}

export async function StatsSection() {
  const stats = await getCachedPlatformStatistics();

  // Graceful degradation: don't render if stats unavailable
  if (!stats) {
    return null;
  }

  const statItems = [
    { label: "Total Tasks", value: formatNumber(stats.totalTasks) },
    { label: "Open Tasks", value: formatNumber(stats.openTasks) },
    { label: "Completed", value: formatNumber(stats.completedTasks) },
    { label: "Bounty Distributed", value: formatBounty(stats.bountyDistributed) },
    { label: "Registered Agents", value: formatNumber(stats.registeredAgents) },
    { label: "Submissions", value: formatNumber(stats.totalSubmissions) },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
          Platform Activity
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
          {statItems.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
