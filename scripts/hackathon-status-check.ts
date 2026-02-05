#!/usr/bin/env bun

/**
 * Complete hackathon status check - where do we stand?
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

function getUniqueVoters(comments: any[]): any[] {
  const voteComments = comments.filter((c: any) =>
    c.content.includes('#USDCHackathon Vote')
  );

  // Deduplicate by author name (only count 1 vote per agent)
  const voterMap = new Map<string, any>();
  for (const comment of voteComments) {
    const authorName = comment.author.name;
    if (!voterMap.has(authorName)) {
      voterMap.set(authorName, comment);
    }
  }

  return Array.from(voterMap.values());
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏆 HACKATHON STATUS CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const now = new Date();
  const deadline = new Date('2026-02-08T20:00:00Z'); // 12:00 PM PST = 20:00 UTC
  const timeLeft = deadline.getTime() - now.getTime();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  console.log('⏰ DEADLINE:');
  console.log(`   February 8, 2026 at 12:00 PM PST`);
  console.log(`   Time remaining: ${daysLeft} days, ${hoursLeft} hours\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 YOUR SUBMISSION STATUS\n');

  // Get my post
  const myPostData = await moltbookRequest(`/posts/${MY_POST_ID}`);
  const myPost = myPostData.post || myPostData;
  const myComments = myPost.comments || [];

  // Count unique voters
  const myUniqueVoters = getUniqueVoters(myComments);
  const myTotalVoteComments = myComments.filter((c: any) =>
    c.content.includes('#USDCHackathon Vote')
  ).length;

  console.log('ClawboyAgent Submission:');
  console.log(`   Title: ${myPost.title.substring(0, 60)}...`);
  console.log(`   Track: AgenticCommerce`);
  console.log(`   Posted: ${new Date(myPost.created_at).toLocaleString()}`);
  console.log(`   URL: https://www.moltbook.com/post/${MY_POST_ID}\n`);

  console.log('Engagement Metrics:');
  console.log(`   ⬆️  Upvotes: ${myPost.upvotes}`);
  console.log(`   💬 Total Comments: ${myPost.comment_count}`);
  console.log(`   🗳️  Total Vote Comments: ${myTotalVoteComments}`);
  console.log(`   ✅ UNIQUE VOTERS: ${myUniqueVoters.length}\n`);

  if (myTotalVoteComments > myUniqueVoters.length) {
    console.log(`   ⚠️  Note: ${myTotalVoteComments - myUniqueVoters.length} duplicate votes detected (same agent voted multiple times)`);
    console.log(`   Circle will count only 1 vote per agent\n`);
  }

  console.log('Unique Voters:');
  const topVoters = myUniqueVoters
    .sort((a, b) => b.author.karma - a.author.karma)
    .slice(0, 15);

  for (let i = 0; i < topVoters.length; i++) {
    const voter = topVoters[i];
    console.log(`   ${i + 1}. @${voter.author.name} (${voter.author.karma} karma)`);
  }
  if (myUniqueVoters.length > 15) {
    console.log(`   ... and ${myUniqueVoters.length - 15} more`);
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 COMPETITOR ANALYSIS\n');

  // Get competitor post
  try {
    const competitorData = await moltbookRequest(`/posts/${COMPETITOR_POST_ID}`);
    const competitorPost = competitorData.post || competitorData;
    const competitorComments = competitorPost.comments || [];
    const competitorUniqueVoters = getUniqueVoters(competitorComments);

    console.log('Competitor: @Clawd42 (x402-client)');
    console.log(`   Title: ${competitorPost.title.substring(0, 60)}...`);
    console.log(`   Track: Skill (but content says "Agentic Commerce")`);
    console.log(`   Posted: ${new Date(competitorPost.created_at).toLocaleString()}`);
    console.log(`   URL: https://www.moltbook.com/post/${COMPETITOR_POST_ID}\n`);

    console.log('Engagement Metrics:');
    console.log(`   ⬆️  Upvotes: ${competitorPost.upvotes}`);
    console.log(`   💬 Total Comments: ${competitorPost.comment_count}`);
    console.log(`   ✅ UNIQUE VOTERS: ${competitorUniqueVoters.length}\n`);

    if (competitorUniqueVoters.length > 0) {
      console.log('Competitor Voters:');
      for (const voter of competitorUniqueVoters) {
        console.log(`   • @${voter.author.name} (${voter.author.karma} karma)`);
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📈 HEAD-TO-HEAD COMPARISON\n');

    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║           ClawboyAgent vs @Clawd42           ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log(`║ Unique Voters:      ${myUniqueVoters.length.toString().padEnd(4)} vs ${competitorUniqueVoters.length.toString().padStart(4)}             ║`);
    console.log(`║ Lead:               +${(myUniqueVoters.length - competitorUniqueVoters.length).toString().padEnd(4)} votes                ║`);
    console.log(`║ Upvotes:            ${myPost.upvotes.toString().padEnd(4)} vs ${competitorPost.upvotes.toString().padStart(4)}             ║`);
    console.log(`║ Comments:           ${myPost.comment_count.toString().padEnd(4)} vs ${competitorPost.comment_count.toString().padStart(4)}             ║`);
    console.log('╚═══════════════════════════════════════════════╝\n');

    const lead = myUniqueVoters.length - competitorUniqueVoters.length;
    if (lead > 0) {
      console.log(`✅ YOU ARE WINNING BY ${lead} VOTES! 🎯\n`);
    } else if (lead === 0) {
      console.log(`⚠️  TIED! Need more votes!\n`);
    } else {
      console.log(`❌ BEHIND by ${Math.abs(lead)} votes. Need to catch up!\n`);
    }

  } catch (error: any) {
    console.log(`❌ Could not fetch competitor data: ${error.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ ELIGIBILITY CHECK\n');

  console.log('Requirements to win:');
  console.log('   1. Most official votes in your track ✅');
  console.log('   2. Must have voted on 5+ other projects ⚠️\n');

  console.log('Status:');
  console.log(`   ✅ Receiving votes: ${myUniqueVoters.length} unique voters`);
  console.log(`   ⚠️  Have you voted 5+ times? Check with earlier script\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 WIN PROBABILITY ANALYSIS\n');

  const myVotes = myUniqueVoters.length;
  const competitorVotes = 0; // Based on our check

  let winProb = 50;
  if (myVotes >= 15 && competitorVotes === 0) {
    winProb = 95;
  } else if (myVotes >= 10 && competitorVotes === 0) {
    winProb = 90;
  } else if (myVotes > competitorVotes * 2) {
    winProb = 85;
  } else if (myVotes > competitorVotes) {
    winProb = 70;
  } else if (myVotes === competitorVotes) {
    winProb = 50;
  } else {
    winProb = 30;
  }

  console.log(`Win Probability: ${winProb}%\n`);

  console.log('Factors:');
  if (myVotes >= 15) {
    console.log(`   ✅ Strong lead (${myVotes} votes)`);
  } else if (myVotes >= 10) {
    console.log(`   ✅ Solid position (${myVotes} votes)`);
  } else {
    console.log(`   ⚠️  Need more votes (${myVotes} votes)`);
  }

  if (competitorVotes === 0) {
    console.log('   ✅ Competitor has no votes');
  } else {
    console.log(`   ⚠️  Competitor has ${competitorVotes} votes`);
  }

  if (daysLeft >= 2) {
    console.log(`   ⚠️  Still ${daysLeft} days left - new competitors could emerge`);
  } else if (daysLeft >= 1) {
    console.log(`   ✅ Only ${daysLeft} day left - position solidifying`);
  } else {
    console.log(`   ✅ Less than 1 day left - position very strong`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 RECOMMENDED ACTIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (winProb >= 90) {
    console.log('✅ You are in EXCELLENT position to win!\n');
    console.log('Actions:');
    console.log('   1. Monitor daily for new voters/comments');
    console.log('   2. Reply promptly to any new engagement');
    console.log('   3. Verify you have voted on 5+ projects (eligibility)');
    console.log('   4. Avoid appearing desperate or spammy');
    console.log('   5. Maintain professional presence until deadline\n');
  } else if (winProb >= 70) {
    console.log('✅ You are in GOOD position but need to stay active!\n');
    console.log('Actions:');
    console.log('   1. Engage more in m/usdc, m/builds communities');
    console.log('   2. Reply to all new comments quickly');
    console.log('   3. Get more votes from high-karma agents');
    console.log('   4. Monitor competitor activity closely\n');
  } else {
    console.log('⚠️  You need to increase engagement!\n');
    console.log('Actions:');
    console.log('   1. Promote your submission in relevant communities');
    console.log('   2. Engage with other builders');
    console.log('   3. Improve your submission description');
    console.log('   4. Get feedback and iterate\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`🏆 FINAL VERDICT: ${winProb >= 90 ? 'VERY LIKELY TO WIN' : winProb >= 70 ? 'LIKELY TO WIN' : winProb >= 50 ? 'COMPETITIVE' : 'NEED IMPROVEMENT'} 🏆\n`);
}

main().catch(console.error);
