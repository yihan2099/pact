'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { Loader2, Plus, X, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { identityRegistryConfig } from '@/lib/contracts';
import { toast } from 'sonner';
import { uploadProfile } from '@/app/actions/ipfs';
import type { AgentProfile } from '@clawboy/shared-types';

interface EditProfileProps {
  agentAddress: string;
  currentName: string;
  currentSkills: string[];
}

export function EditProfile({ agentAddress, currentName, currentSkills }: EditProfileProps) {
  const { address } = useAccount();
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>(currentSkills);
  const [skillInput, setSkillInput] = useState('');
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { data: agentId } = useReadContract({
    ...identityRegistryConfig,
    functionName: 'getAgentIdByWallet',
    args: [agentAddress as `0x${string}`],
  });

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
    if (writeError) toast.error('Failed to update profile');
  }, [writeError]);

  useEffect(() => {
    if (isConfirmed) {
      toast.success('Profile updated successfully!');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- wagmi's useWaitForTransactionReceipt requires useEffect to react to isConfirmed
      setIsEditing(false);
    }
  }, [isConfirmed]);

  // Only show edit button if the connected wallet owns this agent
  if (!address || address.toLowerCase() !== agentAddress.toLowerCase()) {
    return null;
  }

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

  function handleSkillKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetWrite();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (skills.length === 0) {
      toast.error('At least one skill is required');
      return;
    }
    if (!agentId) {
      toast.error('Agent ID not found');
      return;
    }

    const profile: AgentProfile = {
      version: '1.0',
      name: name.trim(),
      description: description.trim() || undefined,
      skills,
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
      ...identityRegistryConfig,
      functionName: 'setAgentURI',
      args: [agentId, `ipfs://${cid}`],
    });
  }

  if (!isEditing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
        <Pencil className="h-4 w-4 mr-1" />
        Edit Profile
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="Your agent display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Describe your agent's capabilities"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-skill-input">Skills</Label>
            <div className="flex gap-2">
              <Input
                id="edit-skill-input"
                placeholder="Add a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
              />
              <Button type="button" variant="outline" size="icon" onClick={addSkill}>
                <Plus className="h-4 w-4" />
              </Button>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-github">GitHub</Label>
            <Input
              id="edit-github"
              placeholder="https://github.com/username"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-twitter">Twitter</Label>
            <Input
              id="edit-twitter"
              placeholder="@username"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {writeError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {writeError.message.slice(0, 300)}
            </div>
          )}

          {txHash && !isConfirmed && (
            <p className="text-xs text-muted-foreground">
              Transaction submitted. Waiting for confirmation...
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isPending || isConfirming || isUploading}
              className="min-w-[140px]"
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
                    : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isPending || isConfirming || isUploading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
