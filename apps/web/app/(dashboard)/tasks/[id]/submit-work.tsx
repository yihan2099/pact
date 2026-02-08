'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { taskManagerConfig } from '@/lib/contracts';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SubmitWorkProps {
  chainTaskId: string;
  status: string;
}

interface DeliverableEntry {
  type: 'code' | 'document' | 'data' | 'file' | 'other';
  description: string;
  cid: string;
  url: string;
}

const DELIVERABLE_TYPES = ['code', 'document', 'data', 'file', 'other'] as const;

function createEmptyDeliverable(): DeliverableEntry {
  return { type: 'code', description: '', cid: '', url: '' };
}

export function SubmitWork({ chainTaskId, status }: SubmitWorkProps) {
  const { address } = useAccount();
  const [isExpanded, setIsExpanded] = useState(false);
  const [summary, setSummary] = useState('');
  const [deliverables, setDeliverables] = useState<DeliverableEntry[]>([createEmptyDeliverable()]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) toast.success('Work submitted successfully!');
  }, [isSuccess]);
  useEffect(() => {
    if (writeError) toast.error('Failed to submit work');
  }, [writeError]);

  // Only show when task is open and wallet is connected
  if (status !== 'open' || !address) {
    return null;
  }

  // Show success state
  if (isSuccess) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-4">
          <p className="text-sm text-green-600 dark:text-green-400">
            Work submitted successfully! Your submission is now visible to the task creator.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isExpanded) {
    return <Button onClick={() => setIsExpanded(true)}>Submit Work</Button>;
  }

  const updateDeliverable = (index: number, field: keyof DeliverableEntry, value: string) => {
    setDeliverables((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const addDeliverable = () => {
    setDeliverables((prev) => [...prev, createEmptyDeliverable()]);
  };

  const removeDeliverable = (index: number) => {
    setDeliverables((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setValidationError(null);

    // Validate summary
    if (!summary.trim()) {
      setValidationError('Summary is required.');
      return;
    }

    // Validate deliverables
    for (let i = 0; i < deliverables.length; i++) {
      const d = deliverables[i];
      if (!d.description.trim()) {
        setValidationError(`Deliverable ${i + 1}: description is required.`);
        return;
      }
      if (!d.cid.trim() && !d.url.trim()) {
        setValidationError(`Deliverable ${i + 1}: at least a CID or URL is required.`);
        return;
      }
    }

    // Build WorkSubmission object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _submission = {
      version: '1.0' as const,
      taskId: chainTaskId,
      summary: summary.trim(),
      deliverables: deliverables.map((d) => ({
        type: d.type,
        description: d.description.trim(),
        ...(d.cid.trim() ? { cid: d.cid.trim() } : {}),
        ...(d.url.trim() ? { url: d.url.trim() } : {}),
      })),
      submittedAt: new Date().toISOString(),
    };

    // TODO: Upload _submission to IPFS via Pinata (needs server-side credentials).
    // For now, use a placeholder CID.
    const submissionCid = 'ipfs://placeholder-submission-cid';

    writeContract({
      ...taskManagerConfig,
      functionName: 'submitWork',
      args: [BigInt(chainTaskId), submissionCid],
    });
  };

  const isLoading = isPending || isConfirming;
  const error = validationError || writeError;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">Submit Work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {typeof error === 'string' ? error : error.message.slice(0, 200)}
          </div>
        )}

        {/* Summary */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="submit-summary">
            Summary
          </label>
          <Textarea
            id="submit-summary"
            placeholder="Briefly describe the work you completed..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* Deliverables */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Deliverables</label>
          {deliverables.map((d, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Deliverable {index + 1}</span>
                {deliverables.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeDeliverable(index)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-[140px_1fr]">
                <select
                  value={d.type}
                  onChange={(e) => updateDeliverable(index, 'type', e.target.value)}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {DELIVERABLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Description"
                  value={d.description}
                  onChange={(e) => updateDeliverable(index, 'description', e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="CID (e.g. Qm...)"
                  value={d.cid}
                  onChange={(e) => updateDeliverable(index, 'cid', e.target.value)}
                  disabled={isLoading}
                />
                <Input
                  placeholder="URL (e.g. https://...)"
                  value={d.url}
                  onChange={(e) => updateDeliverable(index, 'url', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDeliverable}
            disabled={isLoading}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Deliverable
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isPending ? 'Submitting...' : isConfirming ? 'Confirming...' : 'Submit'}
          </Button>
          <Button variant="outline" onClick={() => setIsExpanded(false)} disabled={isLoading}>
            Cancel
          </Button>
        </div>

        {txHash && (
          <p className="text-xs text-muted-foreground">
            Transaction submitted. Waiting for confirmation...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
