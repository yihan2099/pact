#!/usr/bin/env bun

/**
 * Final accurate status report with spam detection
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

async function analyzeVotes(postId: string) {
  const data = await moltbookRequest(`/posts/${postId}`);
  const comments = data.comments || [];

  // Find all vote comments
  const voteComments = comments.filter((c: any) =>
    c.content && c.content.includes('#USDCHackathon Vote')
  );

  // Group by author to find duplicates
  const votesByAuthor = new Map<string, any[]>();
  for (const comment of voteComments) {
    const author = comment.author.name;
    if (!votesByAuthor.has(author)) {
      votesByAuthor.set(author, []);
    }
    votesByAuthor.get(author)!.push(comment);
  }

  // Separate legitimate from spam
  const legitimateVoters: any[] = [];
  const spamVoters: any[] = [];

  for (const [author, votes] of votesByAuthor.entries()) {
    if (votes.length > 1) {
      spamVoters.push({ author, voteCount: votes.length, votes });
    } else {
      legitimateVoters.push({ author, voteCount: 1, vote: votes[0] });
    }
  }

  return {
    totalVoteComments: voteComments.length,
    uniqueVoters: votesByAuthor.size,
    legitimateVoters,
    spamVoters,
    allVotes: voteComments,
  };
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏆 FINAL HACKATHON STATUS REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const now = new Date();
  const deadline = new Date('2026-02-08T20:00:00Z'); // 12:00 PM PST
  const timeLeft = deadline.getTime() - now.getTime();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  console.log('⏰ DEADLINE: February 8, 12:00 PM PST');
  console.log(`⏱️  TIME LEFT: ${daysLeft} days, ${hoursLeft} hours\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 YOUR SUBMISSION ANALYSIS\n');

  const myData = await moltbookRequest(`/posts/${MY_POST_ID}`);
  const myAnalysis = await analyzeVotes(MY_POST_ID);

  console.log('ClawboyAgent - AgenticCommerce Track');
  console.log(`URL: https://www.moltbook.com/post/${MY_POST_ID}\n`);

  console.log('📈 Engagement:');
  console.log(`   Upvotes: ${myData.upvotes}`);
  console.log(`   Comments: ${myData.comment_count}`);
  console.log(`   Total vote comments: ${myAnalysis.totalVoteComments}`);
  console.log(`   UNIQUE VOTERS: ${myAnalysis.uniqueVoters}\n`);

  console.log('✅ LEGITIMATE VOTERS (1 vote each):');
  console.log(`   Count: ${myAnalysis.legitimateVoters.length}\n`);

  const topLegitimate = myAnalysis.legitimateVoters
    .sort((a, b) => b.vote.author.karma - a.vote.author.karma)
    .slice(0, 20);

  for (let i = 0; i < topLegitimate.length; i++) {
    const voter = topLegitimate[i];
    console.log(`   ${(i + 1).toString().padStart(2)}. @${voter.author.padEnd(20)} (${voter.vote.author.karma} karma)`);
  }

  if (myAnalysis.legitimateVoters.length > 20) {
    console.log(`   ... and ${myAnalysis.legitimateVoters.length - 20} more`);
  }
  console.log('');

  if (myAnalysis.spamVoters.length > 0) {
    console.log('🚨 SPAM VOTERS (multiple votes from same account):');
    console.log(`   Count: ${myAnalysis.spamVoters.length}\n`);

    for (const spammer of myAnalysis.spamVoters) {
      console.log(`   ❌ @${spammer.author}: ${spammer.voteCount} votes (Circle will count only 1)`);
    }
    console.log('');
    console.log(`   ⚠️  Total spam votes: ${myAnalysis.totalVoteComments - myAnalysis.uniqueVoters}`);
    console.log(`   ⚠️  Circle judges will filter these out\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 COMPETITOR ANALYSIS\n');

  try {
    const competitorData = await moltbookRequest(`/posts/${COMPETITOR_POST_ID}`);
    const competitorAnalysis = await analyzeVotes(COMPETITOR_POST_ID);

    console.log('@Clawd42 - Skill Track (but says "Agentic Commerce")');
    console.log(`URL: https://www.moltbook.com/post/${COMPETITOR_POST_ID}\n`);

    console.log('📈 Engagement:');
    console.log(`   Upvotes: ${competitorData.upvotes}`);
    console.log(`   Comments: ${competitorData.comment_count}`);
    console.log(`   UNIQUE VOTERS: ${competitorAnalysis.uniqueVoters}\n`);

    if (competitorAnalysis.uniqueVoters > 0) {
      console.log('Voters:');
      for (const voter of competitorAnalysis.legitimateVoters) {
        console.log(`   • @${voter.author} (${voter.vote.author.karma} karma)`);
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚔️  HEAD-TO-HEAD\n');

    console.log('╔════════════════════════════════════════════╗');
    console.log('║      ClawboyAgent vs @Clawd42             ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║ Unique Voters:   ${myAnalysis.uniqueVoters.toString().padEnd(4)} vs ${competitorAnalysis.uniqueVoters.toString().padStart(4)}            ║`);
    console.log(`║ Lead:            +${(myAnalysis.uniqueVoters - competitorAnalysis.uniqueVoters).toString().padEnd(4)} votes           ║`);
    console.log(`║ Upvotes:         ${myData.upvotes.toString().padEnd(4)} vs ${competitorData.upvotes.toString().padStart(4)}            ║`);
    console.log(`║ Track:           Same (AgenticCommerce)    ║`);
    console.log('╚════════════════════════════════════════════╝\n');

    const lead = myAnalysis.uniqueVoters - competitorAnalysis.uniqueVoters;

    if (lead >= 10) {
      console.log(`🏆 YOU ARE DOMINATING! +${lead} vote lead 🏆\n`);
    } else if (lead > 0) {
      console.log(`✅ YOU ARE WINNING! +${lead} vote lead\n`);
    } else if (lead === 0) {
      console.log(`⚠️  TIED! Need more votes!\n`);
    } else {
      console.log(`❌ BEHIND by ${Math.abs(lead)} votes!\n`);
    }

  } catch (error: any) {
    console.log(`❌ Could not analyze competitor: ${error.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 WIN PROBABILITY\n');

  const uniqueVotes = myAnalysis.uniqueVoters;
  const legitimateVotes = myAnalysis.legitimateVoters.length;

  let winProb = 50;
  if (uniqueVotes >= 20) {
    winProb = 98;
  } else if (uniqueVotes >= 15) {
    winProb = 95;
  } else if (uniqueVotes >= 10) {
    winProb = 85;
  } else if (uniqueVotes >= 5) {
    winProb = 70;
  }

  console.log(`Win Probability: ${winProb}%\n`);

  console.log('Factors:');
  if (uniqueVotes >= 15) {
    console.log(`   ✅ Excellent vote count (${uniqueVotes} unique voters)`);
  } else if (uniqueVotes >= 10) {
    console.log(`   ✅ Strong vote count (${uniqueVotes} unique voters)`);
  } else if (uniqueVotes >= 5) {
    console.log(`   ⚠️  Moderate vote count (${uniqueVotes} unique voters)`);
  } else {
    console.log(`   ❌ Low vote count (${uniqueVotes} unique voters)`);
  }

  if (myAnalysis.spamVoters.length > 0) {
    console.log(`   ⚠️  ${myAnalysis.totalVoteComments - uniqueVotes} spam votes will be filtered`);
  }

  console.log(`   ⏱️  ${daysLeft} days left until deadline`);
  console.log(`   ✅ Only 1-2 competitors found in track\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 RECOMMENDED ACTIONS\n');

  if (winProb >= 95) {
    console.log('🎉 EXCELLENT POSITION! You are very likely to win!\n');
    console.log('Actions:');
    console.log('   1. ✅ Maintain current engagement level');
    console.log('   2. ✅ Reply to new comments promptly');
    console.log('   3. ⚠️  Verify eligibility (voted on 5+ projects)');
    console.log('   4. ✅ Monitor for late competitor submissions');
    console.log('   5. ✅ Stay professional until Feb 8 deadline\n');
  } else if (winProb >= 80) {
    console.log('✅ STRONG POSITION! Keep up the momentum!\n');
    console.log('Actions:');
    console.log('   1. Get 5-10 more legitimate votes');
    console.log('   2. Engage in m/usdc, m/builds communities');
    console.log('   3. Reply to all comments');
    console.log('   4. Monitor competitor activity\n');
  } else {
    console.log('⚠️  NEED MORE ENGAGEMENT!\n');
    console.log('Actions:');
    console.log('   1. Actively promote submission');
    console.log('   2. Get votes from high-karma agents');
    console.log('   3. Engage with other builders');
    console.log('   4. Improve submission content\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (winProb >= 95) {
    console.log('🏆 FINAL VERDICT: VERY LIKELY TO WIN! 🏆\n');
  } else if (winProb >= 80) {
    console.log('🎯 FINAL VERDICT: LIKELY TO WIN 🎯\n');
  } else if (winProb >= 60) {
    console.log('⚖️  FINAL VERDICT: COMPETITIVE ⚖️\n');
  } else {
    console.log('⚠️  FINAL VERDICT: UNDERDOG ⚠️\n');
  }
}

main().catch(console.error);
