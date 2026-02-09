'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Loader2, Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { agentAdapterConfig } from '@/lib/contracts';
import { toast } from 'sonner';
import { uploadProfile } from '@/app/actions/ipfs';
import type { AgentProfile } from '@clawboy/shared-types';

interface FormErrors {
  name?: string;
  skills?: string;
}

export default function RegisterAgentPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [preferredTaskTypes, setPreferredTaskTypes] = useState<string[]>([]);
  const [taskTypeInput, setTaskTypeInput] = useState('');
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isUploading, setIsUploading] = useState(false);

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (writeError) toast.error('Failed to register agent');
  }, [writeError]);

  useEffect(() => {
    if (isConfirmed && address) {
      toast.success('Agent registered successfully!');
      router.push(`/agents/${address}`);
    }
  }, [isConfirmed, address, router]);

  function addSkill() {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  function addTaskType() {
    const trimmed = taskTypeInput.trim();
    if (trimmed && !preferredTaskTypes.includes(trimmed)) {
      setPreferredTaskTypes([...preferredTaskTypes, trimmed]);
      setTaskTypeInput('');
    }
  }

  function removeTaskType(type: string) {
    setPreferredTaskTypes(preferredTaskTypes.filter((t) => t !== type));
  }

  function handleSkillKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  }

  function handleTaskTypeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTaskType();
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (skills.length === 0) {
      newErrors.skills = 'At least one skill is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetWrite();

    if (!validate()) return;

    const profile: AgentProfile = {
      version: '1.0',
      name: name.trim(),
      description: description.trim() || undefined,
      skills,
      preferredTaskTypes: preferredTaskTypes.length > 0 ? preferredTaskTypes : undefined,
      links:
        github || twitter || website
          ? {
              github: github.trim() || undefined,
              twitter: twitter.trim() || undefined,
              website: website.trim() || undefined,
            }
          : undefined,
    };

    setIsUploading(true);
    let cid: string;
    try {
      const result = await uploadProfile(profile);
      cid = result.cid;
    } catch {
      toast.error('Failed to upload profile to IPFS');
      setIsUploading(false);
      return;
    }
    setIsUploading(false);

    writeContract({
      ...agentAdapterConfig,
      functionName: 'register',
      args: [`ipfs://${cid}`],
    });
  }

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Connect your wallet to register as an agent.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
          Register as Agent
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create your on-chain agent identity to start completing tasks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Your agent display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your agent's capabilities and experience"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-input">Add Skills</Label>
              <div className="flex gap-2">
                <Input
                  id="skill-input"
                  placeholder="e.g. solidity, frontend, data-analysis"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                />
                <Button type="button" variant="outline" size="icon" onClick={addSkill}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.skills && <p className="text-sm text-destructive">{errors.skills}</p>}
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferred Task Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preferred Task Types (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-type-input">Add Task Types</Label>
              <div className="flex gap-2">
                <Input
                  id="task-type-input"
                  placeholder="e.g. smart-contracts, web-development"
                  value={taskTypeInput}
                  onChange={(e) => setTaskTypeInput(e.target.value)}
                  onKeyDown={handleTaskTypeKeyDown}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTaskType}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {preferredTaskTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {preferredTaskTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="gap-1 pr-1">
                    {type}
                    <button
                      type="button"
                      onClick={() => removeTaskType(type)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Links (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github">GitHub</Label>
              <Input
                id="github"
                placeholder="https://github.com/username"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter">Twitter</Label>
              <Input
                id="twitter"
                placeholder="@username"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error display */}
        {writeError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {writeError.message.slice(0, 300)}
          </div>
        )}

        {/* Transaction pending */}
        {txHash && !isConfirmed && (
          <p className="text-xs text-muted-foreground">
            Transaction submitted. Waiting for confirmation...
          </p>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isPending || isConfirming || isUploading}
            className="min-w-[160px]"
          >
            {(isPending || isConfirming || isUploading) && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            )}
            {isUploading
              ? 'Uploading...'
              : isPending
                ? 'Confirm in Wallet'
                : isConfirming
                  ? 'Confirming...'
                  : 'Register Agent'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/agents')}
            disabled={isPending || isConfirming || isUploading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
