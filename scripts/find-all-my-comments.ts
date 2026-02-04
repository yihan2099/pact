#!/usr/bin/env bun

/**
 * Find ALL comments by ClawboyAgent to see where votes were cast
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

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

async function findAllMyComments() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 FINDING ALL CLAWBOYAGENT COMMENTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get profile
    const profile = await moltbookRequest('/agents/me');
    const agentName = profile.agent.name;
    const agentId = profile.agent.id;

    console.log(`Agent: ${agentName}`);
    console.log(`Total comments: ${profile.agent.stats.comments}\n`);

    // Try to get agent's comments directly (if endpoint exists)
    console.log('Attempting to fetch comments directly...\n');

    try {
      // Try various possible endpoints
      const endpoints = [
        `/agents/me/comments`,
        `/agents/${agentName}/comments`,
        `/agents/${agentId}/comments`,
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying: ${endpoint}`);
          const comments = await moltbookRequest(endpoint);
          console.log('✅ Success! Found comments endpoint\n');
          console.log(JSON.stringify(comments, null, 2));
          return;
        } catch (error) {
          console.log(`  ❌ ${error.message.split(':')[0]}`);
        }
      }
    } catch (error) {
      // Continue to fallback method
    }

    console.log('\nDirect endpoint not available. Searching through posts...\n');

    // Fallback: Search through ALL recent posts in m/usdc
    const allComments: any[] = [];
    let offset = 0;
    const limit = 50;

    for (let page = 0; page < 20; page++) {
      console.log(`Checking page ${page + 1}...`);

      const posts = await moltbookRequest(`/posts?sort=new&limit=${limit}&offset=${offset}`);

      if (!posts.posts || posts.posts.length === 0) {
        console.log('  No more posts\n');
        break;
      }

      // Check each post for our comments
      for (const post of posts.posts) {
        try {
          const commentsData = await moltbookRequest(`/posts/${post.id}/comments?sort=new`);
          const comments = commentsData.comments || [];

          const myComments = comments.filter((comment: any) =>
            comment.author.id === agentId || comment.author.name === agentName
          );

          if (myComments.length > 0) {
            myComments.forEach((comment: any) => {
              allComments.push({
                postId: post.id,
                postTitle: post.title,
                postAuthor: post.author.name,
                postSubmolt: post.submolt.name,
                commentContent: comment.content,
                commentUpvotes: comment.upvotes || 0,
                commentTimestamp: comment.created_at,
                isHackathonPost: post.title.includes('#USDCHackathon') ||
                                 post.title.toLowerCase().includes('hackathon'),
                hasVoteHashtag: comment.content.includes('#USDCHackathon Vote'),
              });
            });
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          // Skip posts that error
          continue;
        }
      }

      console.log(`  Found ${allComments.length} total comment(s) so far`);

      if (allComments.length >= profile.agent.stats.comments) {
        console.log(`  Reached expected comment count (${profile.agent.stats.comments})\n`);
        break;
      }

      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ALL YOUR COMMENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total comments found: ${allComments.length}\n`);

    if (allComments.length === 0) {
      console.log('⚠️  No comments found. This could mean:');
      console.log('   1. Comments are on posts outside the recent 1000');
      console.log('   2. API rate limiting prevented full search');
      console.log('   3. Comments were deleted or not indexed yet\n');
      return;
    }

    // Categorize comments
    const hackathonComments = allComments.filter(c => c.isHackathonPost);
    const officialVotes = allComments.filter(c => c.hasVoteHashtag);
    const nonHackathonComments = allComments.filter(c => !c.isHackathonPost);

    console.log('━━━ BREAKDOWN ━━━\n');
    console.log(`🗳️  Official hackathon votes: ${officialVotes.length}`);
    console.log(`💬 Comments on hackathon posts (no hashtag): ${hackathonComments.length - officialVotes.length}`);
    console.log(`📝 Comments on other posts: ${nonHackathonComments.length}\n`);

    // Show official votes first
    if (officialVotes.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ OFFICIAL HACKATHON VOTES');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      officialVotes.forEach((comment, index) => {
        console.log(`${index + 1}. On @${comment.postAuthor}'s project`);
        console.log(`   Post: ${comment.postTitle.substring(0, 80)}...`);
        console.log(`   Submolt: m/${comment.postSubmolt}`);
        console.log(`   Voted: ${comment.commentTimestamp}`);
        console.log(`   Upvotes: ${comment.commentUpvotes}`);
        console.log(`   Comment:\n   "${comment.commentContent.substring(0, 200)}${comment.commentContent.length > 200 ? '...' : ''}"`);
        console.log(`   🔗 https://www.moltbook.com/m/${comment.postSubmolt}/comments/${comment.postId}\n`);
      });
    }

    // Show hackathon comments without hashtag
    const hackathonNoHashtag = hackathonComments.filter(c => !c.hasVoteHashtag);
    if (hackathonNoHashtag.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  HACKATHON COMMENTS (Missing Hashtag)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('These comments are on hackathon posts but WILL NOT COUNT as votes!\n');

      hackathonNoHashtag.forEach((comment, index) => {
        console.log(`${index + 1}. On @${comment.postAuthor}'s project`);
        console.log(`   Post: ${comment.postTitle.substring(0, 80)}...`);
        console.log(`   ❌ Missing: #USDCHackathon Vote`);
        console.log(`   Comment: "${comment.commentContent.substring(0, 150)}${comment.commentContent.length > 150 ? '...' : ''}"`);
        console.log(`   🔗 https://www.moltbook.com/m/${comment.postSubmolt}/comments/${comment.postId}\n`);
      });
    }

    // Show non-hackathon comments
    if (nonHackathonComments.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 OTHER COMMENTS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      nonHackathonComments.slice(0, 10).forEach((comment, index) => {
        console.log(`${index + 1}. On @${comment.postAuthor}'s post`);
        console.log(`   m/${comment.postSubmolt}: ${comment.postTitle.substring(0, 60)}...`);
        console.log(`   "${comment.commentContent.substring(0, 100)}${comment.commentContent.length > 100 ? '...' : ''}"`);
        console.log('');
      });
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 ELIGIBILITY STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (officialVotes.length >= 5) {
      console.log(`✅ ELIGIBLE: You have ${officialVotes.length} official votes!`);
    } else if (officialVotes.length > 0) {
      console.log(`⚠️  PARTIAL: You have ${officialVotes.length} official vote(s)`);
      console.log(`   Need ${5 - officialVotes.length} more vote(s) to be eligible`);
    } else {
      console.log('❌ NOT ELIGIBLE: No official votes found');
      console.log('   Must cast 5 votes with #USDCHackathon Vote hashtag');
    }

    if (hackathonNoHashtag.length > 0) {
      console.log(`\n💡 You have ${hackathonNoHashtag.length} comment(s) on hackathon posts`);
      console.log('   but they are missing the #USDCHackathon Vote hashtag.');
      console.log('   Consider editing them to add the hashtag if possible.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllMyComments().catch(console.error);
