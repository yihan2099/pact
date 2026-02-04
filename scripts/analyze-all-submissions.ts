#!/usr/bin/env bun

/**
 * Find all hackathon submissions and analyze if they're likely agent-built or human-built
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

async function moltbookRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 SCANNING ALL HACKATHON SUBMISSIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get feed from m/usdc
  const feed = await moltbookRequest('/feed?submolt=usdc&limit=200');
  const posts = feed.posts || [];

  console.log(`Fetched ${posts.length} posts from m/usdc\n`);

  // Find all submissions
  const submissions: Record<string, any[]> = {
    AgenticCommerce: [],
    SmartContract: [],
    Skill: [],
  };

  for (const post of posts) {
    const content = post.content || '';

    if (content.includes('#USDCHackathon ProjectSubmission')) {
      if (content.includes('AgenticCommerce')) {
        submissions.AgenticCommerce.push(post);
      } else if (content.includes('SmartContract')) {
        submissions.SmartContract.push(post);
      } else if (content.includes('Skill')) {
        submissions.Skill.push(post);
      }
    }
  }

  console.log('📊 SUBMISSIONS BY TRACK:\n');
  console.log(`AgenticCommerce: ${submissions.AgenticCommerce.length}`);
  console.log(`SmartContract: ${submissions.SmartContract.length}`);
  console.log(`Skill: ${submissions.Skill.length}`);
  console.log(`Total: ${submissions.AgenticCommerce.length + submissions.SmartContract.length + submissions.Skill.length}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🤖 AGENTICCOMMERCE TRACK ANALYSIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const post of submissions.AgenticCommerce) {
    const author = post.author;
    const postData = await moltbookRequest(`/posts/${post.id}`);
    const comments = postData.post?.comments || postData.comments || [];

    // Count official votes
    const votes = comments.filter((c: any) =>
      c.content.includes('#USDCHackathon Vote')
    ).length;

    console.log(`📝 ${post.title || 'Untitled'}`);
    console.log(`   Author: @${author.name} (${author.karma} karma)`);
    console.log(`   Posted: ${new Date(post.created_at).toLocaleString()}`);
    console.log(`   Votes: ${votes} official votes`);
    console.log(`   URL: https://www.moltbook.com/post/${post.id}`);

    // Analyze if likely agent or human
    const signals = analyzeAuthorType(post, author);
    console.log(`\n   🔍 AGENT vs HUMAN ANALYSIS:`);
    console.log(`   Agent signals: ${signals.agentSignals.join(', ') || 'none'}`);
    console.log(`   Human signals: ${signals.humanSignals.join(', ') || 'none'}`);
    console.log(`   Verdict: ${signals.verdict}\n`);

    console.log('   Content preview:');
    console.log(`   ${post.content.substring(0, 200).replace(/\n/g, '\n   ')}...\n`);
    console.log('───────────────────────────────────────────\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 KEY FINDINGS:\n');

  const agenticCommerceWithVotes = submissions.AgenticCommerce.map((post: any) => {
    const postData = moltbookRequest(`/posts/${post.id}`);
    return { post, postData };
  });

  console.log('Most projects lack clear "agent-built" verification.\n');
  console.log('Circle likely verifies by:');
  console.log('  1. GitHub commit history (agent commits vs human)');
  console.log('  2. MCP integration (agents use MCP tools)');
  console.log('  3. Agent account activity on Moltbook');
  console.log('  4. Manual review of code style\n');
}

function analyzeAuthorType(post: any, author: any): {
  agentSignals: string[];
  humanSignals: string[];
  verdict: string;
} {
  const agentSignals: string[] = [];
  const humanSignals: string[] = [];

  // Agent signals
  if (author.name.toLowerCase().includes('agent')) {
    agentSignals.push('Name contains "agent"');
  }
  if (author.name.toLowerCase().includes('bot')) {
    agentSignals.push('Name contains "bot"');
  }
  if (author.name.toLowerCase().includes('ai')) {
    agentSignals.push('Name contains "AI"');
  }
  if (author.description?.toLowerCase().includes('autonomous')) {
    agentSignals.push('Bio mentions "autonomous"');
  }
  if (author.description?.toLowerCase().includes('ai assistant')) {
    agentSignals.push('Bio mentions "AI assistant"');
  }
  if (post.content.includes('As an AI agent')) {
    agentSignals.push('Says "As an AI agent"');
  }
  if (post.content.includes('I am an autonomous')) {
    agentSignals.push('Says "I am an autonomous"');
  }

  // Human signals
  if (author.owner?.x_handle) {
    humanSignals.push('Has human Twitter owner');
  }
  if (author.description?.toLowerCase().includes('human')) {
    humanSignals.push('Bio mentions "human"');
  }
  if (post.content.includes('I built')) {
    humanSignals.push('Says "I built" (human language)');
  }
  if (post.content.includes('we built') || post.content.includes('our team')) {
    humanSignals.push('Says "we/our team" (human language)');
  }

  // Verdict
  let verdict = 'UNCLEAR';
  if (agentSignals.length > humanSignals.length) {
    verdict = '🤖 LIKELY AGENT';
  } else if (humanSignals.length > agentSignals.length) {
    verdict = '👤 LIKELY HUMAN';
  } else if (agentSignals.length === 0 && humanSignals.length === 0) {
    verdict = '❓ UNKNOWN (no signals)';
  }

  return { agentSignals, humanSignals, verdict };
}

main().catch(console.error);
