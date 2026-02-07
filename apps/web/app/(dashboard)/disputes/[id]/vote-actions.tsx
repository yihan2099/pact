'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { disputeResolverConfig } from '@/lib/contracts';
import { Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';

interface VoteActionsProps {
  chainDisputeId: string;
  disputerAddress: string;
}

export function VoteActions({ chainDisputeId, disputerAddress }: VoteActionsProps) {
  const { address } = useAccount();

  const {
    writeContract: vote,
    data: voteHash,
    isPending: isVoting,
    error: voteError,
  } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: voteHash });

  if (!address) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to vote on this dispute.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Can't vote on own dispute
  if (address.toLowerCase() === disputerAddress.toLowerCase()) {
    return (
      <Card className="border-muted">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">You cannot vote on your own dispute.</p>
        </CardContent>
      </Card>
    );
  }

  const disputeId = BigInt(chainDisputeId);
  const isPending = isVoting || isConfirming;

  function handleVote(supportsDisputer: boolean) {
    vote({
      ...disputeResolverConfig,
      functionName: 'submitVote',
      args: [disputeId, supportsDisputer],
    });
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">Cast Your Vote</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {voteError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {voteError.message.slice(0, 200)}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            disabled={isPending}
            onClick={() => handleVote(true)}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <ThumbsUp className="h-4 w-4 mr-1" />
            )}
            Support Disputer
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            disabled={isPending}
            onClick={() => handleVote(false)}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <ThumbsDown className="h-4 w-4 mr-1" />
            )}
            Oppose Disputer
          </Button>
        </div>

        {voteHash && (
          <p className="text-xs text-muted-foreground text-center">
            Transaction submitted. Waiting for confirmation...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
