#!/usr/bin/env bun

/**
 * Check current vote status on ClawboyAgent's hackathon post
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';
const POST_ID = '224fbb54-14ea-4d21-8efe-067521c54300';

if (!MOLTBOOK_API_KEY) {
  console.error('❌ MOLTBOOK_API_KEY environment variable not found');
  process.exit(1);
}

async function moltbookRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data;
}

async function checkPostStatus() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏆 HACKATHON POST STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get post details
    const post = await moltbookRequest(`/posts/${POST_ID}`);

    console.log(`Title: ${post.post.title.substring(0, 80)}...`);
    console.log(`Posted: ${post.post.created_at}`);
    console.log(`Last updated: ${new Date().toISOString()}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VOTE STATISTICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`⬆️  Upvotes: ${post.post.upvotes}`);
    console.log(`⬇️  Downvotes: ${post.post.downvotes}`);
    console.log(`📈 Net Score: +${post.post.upvotes - post.post.downvotes}`);
    console.log(`💬 Total Comments: ${post.post.comment_count}\n`);

    // Get comments
    const commentsData = await moltbookRequest(`/posts/${POST_ID}/comments?sort=top`);
    const comments = commentsData.comments || [];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗳️  OFFICIAL HACKATHON VOTES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check for official votes with #USDCHackathon Vote hashtag
    const officialVotes = comments.filter((comment: any) =>
      comment.content.includes('#USDCHackathon Vote') ||
      comment.content.includes('#USDCHackathon') && comment.content.toLowerCase().includes('vote')
    );

    if (officialVotes.length === 0) {
      console.log('⚠️  WARNING: NO OFFICIAL VOTES FOUND!\n');
      console.log('Official votes must include: #USDCHackathon Vote\n');
      console.log('Your upvotes and comments do NOT count as official hackathon votes.');
      console.log('Only comments with the hashtag format count for judging.\n');
    } else {
      console.log(`✅ Found ${officialVotes.length} official vote(s):\n`);

      officialVotes.forEach((vote: any, index: number) => {
        console.log(`${index + 1}. @${vote.author.name} (${vote.upvotes || 0} upvotes)`);
        console.log(`   "${vote.content.substring(0, 150)}${vote.content.length > 150 ? '...' : ''}"`);
        console.log('');
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ALL COMMENTS BREAKDOWN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const commentTypes = {
      officialVotes: 0,
      positive: 0,
      critical: 0,
      spam: 0,
      other: 0,
    };

    comments.forEach((comment: any) => {
      if (comment.content.includes('#USDCHackathon Vote')) {
        commentTypes.officialVotes++;
      } else if (comment.content.toLowerCase().includes('love') ||
                 comment.content.toLowerCase().includes('great') ||
                 comment.content.toLowerCase().includes('impressive')) {
        commentTypes.positive++;
      } else if (comment.content.toLowerCase().includes('scam') ||
                 comment.content.toLowerCase().includes('wrong') ||
                 comment.content.toLowerCase().includes('problem')) {
        commentTypes.critical++;
      } else if (comment.content.includes('$CLAW') ||
                 comment.content.includes('x402') ||
                 comment.author.name.toLowerCase().includes('bot')) {
        commentTypes.spam++;
      } else {
        commentTypes.other++;
      }
    });

    console.log(`🗳️  Official Votes: ${commentTypes.officialVotes}`);
    console.log(`✅ Positive Comments: ${commentTypes.positive}`);
    console.log(`⚠️  Critical Comments: ${commentTypes.critical}`);
    console.log(`🤖 Spam/Promotional: ${commentTypes.spam}`);
    console.log(`➖ Other: ${commentTypes.other}`);
    console.log(`📊 Total: ${comments.length}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 ELIGIBILITY STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check your voting status (need to search for ClawboyAgent's comments on other posts)
    console.log('⚠️  CRITICAL: To be eligible, YOU must vote on 5+ other projects!\n');
    console.log('Check if ClawboyAgent has commented on 5+ other posts with:');
    console.log('   #USDCHackathon Vote\n');

    if (commentTypes.officialVotes === 0) {
      console.log('❌ RISK: No official votes received yet.');
      console.log('   Winning depends on agent votes, not just upvotes!\n');
    } else {
      console.log(`✅ Receiving official votes: ${commentTypes.officialVotes}`);
      console.log('   Keep promoting to get more agent votes!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 VIEW POST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`https://www.moltbook.com/m/usdc/comments/${POST_ID}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPostStatus().catch(console.error);
