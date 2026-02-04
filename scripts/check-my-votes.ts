#!/usr/bin/env bun

/**
 * Check if ClawboyAgent has voted on 5+ other hackathon projects
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

async function checkMyVotes() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗳️  CLAWBOYAGENT VOTING STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get profile to confirm agent name
    const profile = await moltbookRequest('/agents/me');
    const agentName = profile.agent.name;
    const agentId = profile.agent.id;

    console.log(`Agent: ${agentName}`);
    console.log(`Comments: ${profile.agent.stats.comments}\n`);

    // Search for hackathon posts in m/usdc
    console.log('🔍 Searching for hackathon submissions in m/usdc...\n');

    const posts = await moltbookRequest('/posts?sort=new&limit=100');

    const hackathonPosts = posts.posts.filter((post: any) =>
      post.submolt.name === 'usdc' &&
      post.title.includes('#USDCHackathon ProjectSubmission')
    );

    console.log(`Found ${hackathonPosts.length} hackathon submissions\n`);

    // Check each post for ClawboyAgent comments
    const myVotes: any[] = [];
    let checked = 0;

    console.log('Checking for ClawboyAgent votes...\n');

    for (const post of hackathonPosts.slice(0, 50)) { // Check first 50 posts
      try {
        const commentsData = await moltbookRequest(`/posts/${post.id}/comments?sort=new`);
        const comments = commentsData.comments || [];

        const myComments = comments.filter((comment: any) =>
          comment.author.id === agentId || comment.author.name === agentName
        );

        myComments.forEach((comment: any) => {
          const isOfficialVote = comment.content.includes('#USDCHackathon Vote');

          myVotes.push({
            postId: post.id,
            postTitle: post.title.substring(0, 80),
            postAuthor: post.author.name,
            comment: comment.content.substring(0, 150),
            isOfficialVote,
            timestamp: comment.created_at,
          });
        });

        checked++;
        if (checked % 10 === 0) {
          console.log(`  Checked ${checked} posts...`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        // Skip posts that error
        continue;
      }
    }

    console.log(`\n✅ Checked ${checked} hackathon posts\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VOTING RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const officialVotes = myVotes.filter(v => v.isOfficialVote);

    console.log(`Total comments on hackathon posts: ${myVotes.length}`);
    console.log(`Official votes (#USDCHackathon Vote): ${officialVotes.length}\n`);

    if (officialVotes.length === 0) {
      console.log('❌ WARNING: NO OFFICIAL VOTES FOUND!\n');
      console.log('You MUST vote on 5+ other projects to be eligible!\n');
      console.log('To vote, comment on other hackathon posts with:');
      console.log('   #USDCHackathon Vote\n');
      console.log('   [Explain what you like about their project]\n');
    } else {
      console.log(`✅ Official votes cast: ${officialVotes.length}\n`);

      if (officialVotes.length < 5) {
        console.log(`⚠️  ELIGIBILITY RISK: Need ${5 - officialVotes.length} more vote(s)!\n`);
      } else {
        console.log('✅ ELIGIBLE: You have voted on 5+ projects!\n');
      }

      console.log('Your votes:\n');
      officialVotes.forEach((vote, index) => {
        console.log(`${index + 1}. @${vote.postAuthor}'s project`);
        console.log(`   "${vote.postTitle}${vote.postTitle.length >= 80 ? '...' : ''}"`);
        console.log(`   Voted: ${vote.timestamp}`);
        console.log(`   Comment: "${vote.comment}${vote.comment.length >= 150 ? '...' : ''}"`);
        console.log('');
      });
    }

    if (myVotes.length > officialVotes.length) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  NON-OFFICIAL COMMENTS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('These comments will NOT count as official votes:\n');

      const nonOfficialComments = myVotes.filter(v => !v.isOfficialVote);
      nonOfficialComments.slice(0, 5).forEach((comment, index) => {
        console.log(`${index + 1}. @${comment.postAuthor}'s project`);
        console.log(`   Comment: "${comment.comment}${comment.comment.length >= 150 ? '...' : ''}"`);
        console.log('   ❌ Missing: #USDCHackathon Vote\n');
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (officialVotes.length < 5) {
      console.log('ACTION REQUIRED:');
      console.log(`1. Find ${5 - officialVotes.length} more hackathon project(s) in m/usdc`);
      console.log('2. Read their submission carefully');
      console.log('3. Comment with: #USDCHackathon Vote');
      console.log('4. Explain what you genuinely like about their project\n');
      console.log('Deadline: Feb 8, 12:00 PM PST\n');
    } else {
      console.log('✅ Eligibility requirement met!');
      console.log('✅ Keep promoting your post to get more votes');
      console.log('✅ Consider voting on more projects to build community goodwill\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMyVotes().catch(console.error);
