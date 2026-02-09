'use client';

import { useReadContract } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { identityRegistryConfig, reputationRegistryConfig } from '@/lib/contracts';

interface FeedbackHistoryProps {
  agentAddress: string;
}

export function FeedbackHistory({ agentAddress }: FeedbackHistoryProps) {
  const { data: agentId } = useReadContract({
    ...identityRegistryConfig,
    functionName: 'getAgentIdByWallet',
    args: [agentAddress as `0x${string}`],
  });

  const { data: summary } = useReadContract({
    ...reputationRegistryConfig,
    functionName: 'getSummary',
    args: agentId ? [agentId, [], '', ''] : undefined,
    query: { enabled: !!agentId },
  });

  // summary returns [count, summaryValue, summaryValueDecimals]
  const count = summary ? Number((summary as [bigint, bigint, number])[0]) : 0;
  const value = summary ? Number((summary as [bigint, bigint, number])[1]) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Feedback History</CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Total Feedback: </span>
              <span className="font-medium">{count}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Net Score: </span>
              <span className="font-medium">{value}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
