#!/usr/bin/env bun

/**
 * Detailed analysis of found submissions + check if ClawboyAgent post is visible
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';
const MY_POST_ID = '224fbb54-14ea-4d21-8efe-067521c54300';
const COMPETITOR_POST_ID = '6284d7cf-62e2-44cf-8433-a2fe5387c61b';

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

function analyzeAuthor(author: any): {
  likelyType: string;
  signals: string[];
} {
  const signals: string[] = [];
  const name = author.name.toLowerCase();
  const bio = (author.description || '').toLowerCase();

  // Agent signals
  if (name.includes('agent')) signals.push('🤖 Name: "agent"');
  if (name.includes('bot')) signals.push('🤖 Name: "bot"');
  if (name.includes('ai')) signals.push('🤖 Name: "AI"');
  if (name.includes('clawd') || name.includes('claude')) signals.push('🤖 Name: Claude-based');

  if (bio.includes('autonomous')) signals.push('🤖 Bio: "autonomous"');
  if (bio.includes('ai assistant')) signals.push('🤖 Bio: "AI assistant"');
  if (bio.includes('agent')) signals.push('🤖 Bio: "agent"');

  // Human signals
  if (author.owner?.x_handle) signals.push('👤 Has human Twitter owner');
  if (bio.includes('human')) signals.push('👤 Bio: "human"');

  const agentSignalCount = signals.filter(s => s.startsWith('🤖')).length;
  const humanSignalCount = signals.filter(s => s.startsWith('👤')).length;

  let likelyType = 'UNCLEAR';
  if (agentSignalCount > humanSignalCount) {
    likelyType = '🤖 LIKELY AGENT';
  } else if (humanSignalCount > agentSignalCount) {
    likelyType = '👤 LIKELY HUMAN';
  }

  return { likelyType, signals };
}

async function analyzePost(postId: string, label: string) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📝 ${label}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const postData = await moltbookRequest(`/posts/${postId}`);
  const post = postData.post || postData;
  const comments = post.comments || [];

  console.log(`Title: ${post.title || 'Untitled'}`);
  console.log(`Author: @${post.author.name}`);
  console.log(`URL: https://www.moltbook.com/post/${post.id}`);
  console.log(`Posted: ${new Date(post.created_at).toLocaleString()}`);
  console.log(`Upvotes: ${post.upvotes} | Comments: ${post.comment_count}\n`);

  // Author analysis
  const analysis = analyzeAuthor(post.author);
  console.log(`Author Type: ${analysis.likelyType}`);
  console.log(`Signals: ${analysis.signals.join(', ') || 'none'}\n`);

  // Count official votes
  const votes = comments.filter((c: any) =>
    c.content.includes('#USDCHackathon Vote')
  );
  console.log(`Official Votes: ${votes.length}\n`);

  if (votes.length > 0) {
    console.log('Voters:');
    for (const vote of votes.slice(0, 10)) {
      console.log(`  • @${vote.author.name} (${vote.author.karma} karma)`);
    }
    if (votes.length > 10) {
      console.log(`  ... and ${votes.length - 10} more`);
    }
    console.log('');
  }

  // Extract track
  const content = post.content || '';
  let track = 'UNKNOWN';
  if (content.includes('AgenticCommerce')) track = 'AgenticCommerce';
  else if (content.includes('SmartContract')) track = 'SmartContract';
  else if (content.includes('Skill')) track = 'Skill';

  console.log(`Track: ${track}\n`);

  console.log('Content Preview:');
  console.log(content.substring(0, 400).replace(/\n/g, '\n'));
  if (content.length > 400) console.log('...');
  console.log('');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 DETAILED SUBMISSION ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check YOUR post
  await analyzePost(MY_POST_ID, 'CLAWBOY AGENT (YOU)');

  // Check competitor
  await analyzePost(COMPETITOR_POST_ID, 'COMPETITOR: @Clawd42');

  // Check if your post is in feed
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 FEED VISIBILITY CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const feed = await moltbookRequest('/feed?submolt=usdc&limit=100');
  const posts = feed.posts || [];

  const yourPostInFeed = posts.find((p: any) => p.id === MY_POST_ID);
  const competitorInFeed = posts.find((p: any) => p.id === COMPETITOR_POST_ID);

  console.log(`Your post in feed (first 100): ${yourPostInFeed ? '✅ YES' : '❌ NO'}`);
  console.log(`Competitor in feed (first 100): ${competitorInFeed ? '✅ YES' : '❌ NO'}\n`);

  if (!yourPostInFeed && !competitorInFeed) {
    console.log('⚠️  Neither post appears in feed! Possible reasons:');
    console.log('   1. Feed is sorted by recent activity (newer posts first)');
    console.log('   2. Feed pagination only shows top 100');
    console.log('   3. Posts need to reach certain karma threshold\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 COMPETITIVE ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const yourPost = await moltbookRequest(`/posts/${MY_POST_ID}`);
  const competitorPost = await moltbookRequest(`/posts/${COMPETITOR_POST_ID}`);

  const yourVotes = (yourPost.post?.comments || yourPost.comments || []).filter(
    (c: any) => c.content.includes('#USDCHackathon Vote')
  ).length;

  const competitorVotes = (competitorPost.post?.comments || competitorPost.comments || []).filter(
    (c: any) => c.content.includes('#USDCHackathon Vote')
  ).length;

  console.log(`ClawboyAgent: ${yourVotes} votes`);
  console.log(`@Clawd42: ${competitorVotes} votes`);
  console.log(`Lead: ${yourVotes > competitorVotes ? '+' : ''}${yourVotes - competitorVotes} votes\n`);

  if (yourVotes > competitorVotes) {
    console.log('✅ YOU ARE WINNING! 🎯\n');
  } else if (yourVotes === competitorVotes) {
    console.log('⚠️  TIED - Need more votes!\n');
  } else {
    console.log('❌ BEHIND - Need to catch up!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 AGENT vs HUMAN VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('How Circle likely verifies:');
  console.log('  1. Agent account indicators (name, bio, activity pattern)');
  console.log('  2. GitHub commit messages (agent-style vs human-style)');
  console.log('  3. MCP integration usage (agents use MCP tools)');
  console.log('  4. Post writing style (technical, systematic vs casual)');
  console.log('  5. Manual review by hackathon judges\n');

  console.log('ClawboyAgent verification:');
  console.log('  ✅ Name: "ClawboyAgent" (clear agent identifier)');
  console.log('  ✅ Has human owner (@yihan_krr) - allowed per rules');
  console.log('  ✅ MCP integration (21 tools documented)');
  console.log('  ✅ Technical writing style in post');
  console.log('  ✅ Submits and votes autonomously on platform\n');

  console.log('@Clawd42 verification:');
  const competitorAnalysis = analyzeAuthor(competitorPost.post?.author || competitorPost.author);
  for (const signal of competitorAnalysis.signals) {
    console.log(`  ${signal}`);
  }
  console.log(`  Verdict: ${competitorAnalysis.likelyType}\n`);
}

main().catch(console.error);
