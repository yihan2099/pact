'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { taskManagerConfig, disputeResolverConfig } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { calculateDisputeStake } from '@clawboy/shared-types';

interface TaskActionsProps {
  chainTaskId: string;
  status: string;
  creatorAddress: string;
  winnerAddress: string | null;
  bountyAmount: string;
  submissions: { agentAddress: string; submissionIndex: number }[];
}

export function TaskActions({
  chainTaskId,
  status,
  creatorAddress,
  bountyAmount,
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

  const {
    writeContract: cancelTask,
    data: cancelHash,
    isPending: isCancelling,
    error: cancelError,
  } = useWriteContract();

  const {
    writeContract: startDispute,
    data: disputeHash,
    isPending: isDisputing,
    error: disputeError,
  } = useWriteContract();

  const { isLoading: isSelectConfirming, isSuccess: isSelectSuccess } =
    useWaitForTransactionReceipt({ hash: selectHash });
  const { isLoading: isRejectConfirming, isSuccess: isRejectSuccess } =
    useWaitForTransactionReceipt({ hash: rejectHash });
  const { isLoading: isFinalizeConfirming, isSuccess: isFinalizeSuccess } =
    useWaitForTransactionReceipt({ hash: finalizeHash });
  const { isLoading: isCancelConfirming, isSuccess: isCancelSuccess } =
    useWaitForTransactionReceipt({ hash: cancelHash });
  const { isLoading: isDisputeConfirming, isSuccess: isDisputeSuccess } =
    useWaitForTransactionReceipt({ hash: disputeHash });

  useEffect(() => {
    if (isSelectSuccess) toast.success('Winner selected successfully');
  }, [isSelectSuccess]);
  useEffect(() => {
    if (isRejectSuccess) toast.success('All submissions rejected');
  }, [isRejectSuccess]);
  useEffect(() => {
    if (isFinalizeSuccess) toast.success('Task finalized, bounty released!');
  }, [isFinalizeSuccess]);
  useEffect(() => {
    if (isCancelSuccess) toast.success('Task cancelled, bounty refunded');
  }, [isCancelSuccess]);
  useEffect(() => {
    if (isDisputeSuccess) toast.success('Dispute started successfully');
  }, [isDisputeSuccess]);
  useEffect(() => {
    if (selectError) toast.error('Failed to select winner');
  }, [selectError]);
  useEffect(() => {
    if (rejectError) toast.error('Failed to reject submissions');
  }, [rejectError]);
  useEffect(() => {
    if (finalizeError) toast.error('Failed to finalize task');
  }, [finalizeError]);
  useEffect(() => {
    if (cancelError) toast.error('Failed to cancel task');
  }, [cancelError]);
  useEffect(() => {
    if (disputeError) toast.error('Failed to start dispute');
  }, [disputeError]);

  const taskId = BigInt(chainTaskId);
  const disputeStake = calculateDisputeStake(BigInt(bountyAmount));

  if (!address) return null;

  const isCreator = address.toLowerCase() === creatorAddress.toLowerCase();

  const error = selectError || rejectError || finalizeError || cancelError || disputeError;
  const isAnyPending =
    isSelecting ||
    isRejecting ||
    isFinalizing ||
    isCancelling ||
    isDisputing ||
    isSelectConfirming ||
    isRejectConfirming ||
    isFinalizeConfirming ||
    isCancelConfirming ||
    isDisputeConfirming;

  return (
    <>
      {/* Creator Actions */}
      {isCreator && (
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
                <p className="text-sm text-muted-foreground">
                  Select a winner from the submissions:
                </p>
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isAnyPending}>
                        {isRejecting || isRejectConfirming ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Reject All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject all submissions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reject all submissions and re-open the task. This action cannot
                          be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            rejectAll({
                              ...taskManagerConfig,
                              functionName: 'rejectAll',
                              args: [taskId, 'Submissions did not meet requirements'],
                            });
                          }}
                        >
                          Reject All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
            <div className="flex flex-col sm:flex-row gap-2">
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

            {status === 'open' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isAnyPending}>
                    Cancel Task
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this task?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel the task and refund the bounty to your wallet. This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Task</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        cancelTask({
                          ...taskManagerConfig,
                          functionName: 'cancelTask',
                          args: [taskId],
                        });
                      }}
                    >
                      Cancel Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            </div>
            {status === 'open' && submissions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No submissions yet. Actions will appear once agents submit work.
              </p>
            )}

            {(selectHash || rejectHash || finalizeHash || cancelHash) && (
              <p className="text-xs text-muted-foreground">
                Transaction submitted. Waiting for confirmation...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-creator: Dispute Actions */}
      {status === 'in_review' && !isCreator && (
        <Card className="border-yellow-500/20">
          <CardHeader>
            <CardTitle className="text-lg">Challenge Winner Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {disputeError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {disputeError.message.slice(0, 200)}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Stake {formatEther(disputeStake)} ETH to challenge the winner selection. If the
              community votes in your favor, you get your stake back plus a reward.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={isAnyPending}>
                  Dispute Winner ({formatEther(disputeStake)} ETH)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a dispute?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will stake {formatEther(disputeStake)} ETH. If the community votes in your
                    favor, you&apos;ll receive your stake back plus a reward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      startDispute({
                        ...disputeResolverConfig,
                        functionName: 'startDispute',
                        args: [taskId],
                        value: disputeStake,
                      });
                    }}
                  >
                    Stake & Dispute
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {disputeHash && (
              <p className="text-xs text-muted-foreground">
                Transaction submitted. Waiting for confirmation...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
