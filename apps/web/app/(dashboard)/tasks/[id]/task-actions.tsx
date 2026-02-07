'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { taskManagerConfig } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';

interface TaskActionsProps {
  chainTaskId: string;
  status: string;
  creatorAddress: string;
  winnerAddress: string | null;
  submissions: { agentAddress: string; submissionIndex: number }[];
}

export function TaskActions({
  chainTaskId,
  status,
  creatorAddress,
  submissions,
}: TaskActionsProps) {
  const { address } = useAccount();
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);

  const {
    writeContract: selectWinner,
    data: selectHash,
    isPending: isSelecting,
    error: selectError,
  } = useWriteContract();

  const {
    writeContract: rejectAll,
    data: rejectHash,
    isPending: isRejecting,
    error: rejectError,
  } = useWriteContract();

  const {
    writeContract: finalizeTask,
    data: finalizeHash,
    isPending: isFinalizing,
    error: finalizeError,
  } = useWriteContract();

  const { isLoading: isSelectConfirming } = useWaitForTransactionReceipt({ hash: selectHash });
  const { isLoading: isRejectConfirming } = useWaitForTransactionReceipt({ hash: rejectHash });
  const { isLoading: isFinalizeConfirming } = useWaitForTransactionReceipt({ hash: finalizeHash });

  const isCreator = address?.toLowerCase() === creatorAddress.toLowerCase();
  const taskId = BigInt(chainTaskId);

  // Only show actions if wallet is connected and user is the creator
  if (!address || !isCreator) {
    return null;
  }

  const error = selectError || rejectError || finalizeError;
  const isAnyPending =
    isSelecting ||
    isRejecting ||
    isFinalizing ||
    isSelectConfirming ||
    isRejectConfirming ||
    isFinalizeConfirming;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">Creator Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message.slice(0, 200)}
          </div>
        )}

        {status === 'open' && submissions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a winner from the submissions:</p>
            <div className="flex flex-wrap gap-2">
              {submissions.map((sub) => (
                <Button
                  key={sub.agentAddress}
                  variant={selectedWinner === sub.agentAddress ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWinner(sub.agentAddress)}
                  className="font-mono text-xs"
                >
                  {sub.agentAddress.slice(0, 6)}...{sub.agentAddress.slice(-4)}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!selectedWinner || isAnyPending}
                onClick={() => {
                  if (!selectedWinner) return;
                  selectWinner({
                    ...taskManagerConfig,
                    functionName: 'selectWinner',
                    args: [taskId, selectedWinner as `0x${string}`],
                  });
                }}
              >
                {isSelecting || isSelectConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Select Winner
              </Button>
              <Button
                variant="destructive"
                disabled={isAnyPending}
                onClick={() => {
                  rejectAll({
                    ...taskManagerConfig,
                    functionName: 'rejectAll',
                    args: [taskId, 'Submissions did not meet requirements'],
                  });
                }}
              >
                {isRejecting || isRejectConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Reject All
              </Button>
            </div>
          </div>
        )}

        {status === 'in_review' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Once the challenge window passes, finalize the task to release the bounty.
            </p>
            <Button
              disabled={isAnyPending}
              onClick={() => {
                finalizeTask({
                  ...taskManagerConfig,
                  functionName: 'finalizeTask',
                  args: [taskId],
                });
              }}
            >
              {isFinalizing || isFinalizeConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Finalize Task
            </Button>
          </div>
        )}

        {status === 'open' && submissions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No submissions yet. Actions will appear once agents submit work.
          </p>
        )}

        {(selectHash || rejectHash || finalizeHash) && (
          <p className="text-xs text-muted-foreground">
            Transaction submitted. Waiting for confirmation...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
