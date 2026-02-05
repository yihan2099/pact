#!/usr/bin/env bun

/**
 * Detailed analysis of projects to vote on
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

const PROJECTS_TO_ANALYZE = [
  { id: '7dd09bff-412f-475f-8a1c-997a069dac1b', name: 'Rose Protocol', track: 'AgenticCommerce' },
  { id: '6284d7cf-62e2-44cf-8433-a2fe5387c61b', name: '@Clawd42 x402-client', track: 'Skill' },
  { id: '47687d6e-ce87-4b0c-bd08-bf0d98e4299b', name: '@Clawshi', track: 'Skill' },
  { id: '78750cca-bd7b-42ff-ad5f-a029fa227654', name: '@Minara', track: 'Skill' },
  { id: '89e28ffc-6afc-4e50-a57d-b9eab4849adf', name: '@SevenSeeker Mothpay', track: 'Skill' },
  { id: 'fe08e8f6-4f9e-485d-b4dd-7bffcff89186', name: '@ZopAI', track: 'Unknown' },
];

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

async function analyzeProject(projectId: string, projectName: string, track: string) {
  try {
    const data = await moltbookRequest(`/posts/${projectId}`);
    const post = data.post || data;
    const comments = post.comments || [];

    // Count votes
    const votes = comments.filter((c: any) =>
      c.content && c.content.includes('#USDCHackathon Vote')
    );

    // Get unique voters
    const uniqueVoters = new Set(votes.map((v: any) => v.author.name));

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 ${projectName} [${track}]`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Author: @${post.author.name}`);
    console.log(`Posted: ${new Date(post.created_at).toLocaleString()}`);
    console.log(`URL: https://www.moltbook.com/post/${projectId}\n`);

    console.log('📊 Stats:');
    console.log(`   Upvotes: ${post.upvotes}`);
    console.log(`   Comments: ${post.comment_count}`);
    console.log(`   Official Votes: ${uniqueVoters.size}\n`);

    console.log('📄 Description:');
    const preview = post.content.substring(0, 500).replace(/\n/g, '\n   ');
    console.log(`   ${preview}...\n`);

    console.log('🎯 Should you vote?');

    if (track === 'AgenticCommerce') {
      console.log('   ⚠️  DIRECT COMPETITOR in your track!');
      console.log('   Consider: Voting shows sportsmanship and confidence');
      console.log('   However: Not required, and could help them win\n');
    } else {
      console.log('   ✅ Different track - safe to vote');
      console.log('   Voting builds community reputation\n');
    }

    console.log('💬 Top Comments:');
    const topComments = comments
      .filter((c: any) => !c.content.includes('#USDCHackathon Vote'))
      .slice(0, 3);

    if (topComments.length > 0) {
      for (const comment of topComments) {
        console.log(`   @${comment.author.name}: "${comment.content.substring(0, 80).replace(/\n/g, ' ')}..."`);
      }
    } else {
      console.log('   (No regular comments yet)');
    }
    console.log('\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error: any) {
    console.log(`❌ Failed to analyze ${projectName}: ${error.message}\n`);
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗳️  PROJECT VOTING GUIDE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Note: You have already voted on 5 projects (eligible).');
  console.log('Voting on more projects is optional but shows good sportsmanship.\n');

  for (const project of PROJECTS_TO_ANALYZE) {
    await analyzeProject(project.id, project.name, project.track);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 VOTING RECOMMENDATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('SAFE TO VOTE (different tracks):');
  console.log('  ✅ @Clawshi (Skill) - Popular submission');
  console.log('  ✅ @Minara (Skill) - High engagement');
  console.log('  ✅ @SevenSeeker Mothpay (Skill) - Agent-to-agent payments');
  console.log('  ✅ @ZopAI (Unknown) - Semantic search');
  console.log('  ✅ @Clawd42 x402-client (Skill) - Payment infrastructure\n');

  console.log('STRATEGIC DECISION (same track):');
  console.log('  ⚠️  Rose Protocol (AgenticCommerce) - DIRECT COMPETITOR');
  console.log('     Pros: Shows confidence, sportsmanship, community spirit');
  console.log('     Cons: Could help competitor win your track');
  console.log('     Current lead: You have 26 votes, they likely have fewer');
  console.log('     Recommendation: Your call - you have a strong lead (+23 over @Clawd42)\n');

  console.log('💡 SUGGESTED STRATEGY:');
  console.log('  1. Vote for impressive Skill track projects (shows you reviewed hackathon)');
  console.log('  2. Consider voting for Rose Protocol (shows class and confidence)');
  console.log('  3. Leave thoughtful comments explaining what you liked\n');
}

main().catch(console.error);
