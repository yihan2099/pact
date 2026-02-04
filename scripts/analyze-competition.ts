#!/usr/bin/env bun

/**
 * Analyze competition - check vote counts on all hackathon projects
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

async function analyzeCompetition() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏆 HACKATHON COMPETITION ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Search for all hackathon posts
    console.log('Searching for hackathon submissions...\n');

    const allProjects: any[] = [];
    let offset = 0;
    const limit = 50;

    for (let page = 0; page < 10; page++) {
      const posts = await moltbookRequest(`/posts?sort=new&limit=${limit}&offset=${offset}`);

      if (!posts.posts || posts.posts.length === 0) break;

      const hackathonPosts = posts.posts.filter((post: any) =>
        post.submolt.name === 'usdc' &&
        (post.title.includes('#USDCHackathon ProjectSubmission') ||
         post.title.toLowerCase().includes('usdchackathon'))
      );

      for (const post of hackathonPosts) {
        // Get comments to count official votes
        try {
          const commentsData = await moltbookRequest(`/posts/${post.id}/comments?sort=new`);
          const comments = commentsData.comments || [];

          const officialVotes = comments.filter((c: any) =>
            c.content.includes('#USDCHackathon Vote')
          );

          // Determine track
          let track = 'Unknown';
          if (post.title.includes('AgenticCommerce')) track = 'AgenticCommerce';
          else if (post.title.includes('SmartContract')) track = 'SmartContract';
          else if (post.title.includes('Skill')) track = 'Skill';

          allProjects.push({
            id: post.id,
            title: post.title,
            author: post.author.name,
            track,
            upvotes: post.upvotes,
            downvotes: post.downvotes,
            netScore: post.upvotes - post.downvotes,
            totalComments: post.comment_count,
            officialVotes: officialVotes.length,
            created: post.created_at,
          });

          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          // Skip if can't get comments
          console.log(`  Skipped post ${post.id} due to error`);
        }
      }

      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Found ${allProjects.length} hackathon projects\n`);

    // Group by track
    const byTrack: Record<string, any[]> = {
      AgenticCommerce: [],
      SmartContract: [],
      Skill: [],
      Unknown: [],
    };

    allProjects.forEach(p => byTrack[p.track].push(p));

    // Sort each track by official votes
    Object.keys(byTrack).forEach(track => {
      byTrack[track].sort((a, b) => b.officialVotes - a.officialVotes);
    });

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 LEADERBOARD BY TRACK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    Object.entries(byTrack).forEach(([track, projects]) => {
      if (projects.length === 0) return;

      console.log(`\n━━━ ${track} Track ($10,000 USDC) ━━━\n`);
      console.log(`${projects.length} project(s) competing\n`);

      projects.forEach((p, index) => {
        const isYou = p.author === 'ClawboyAgent';
        const marker = isYou ? '👉 YOU' : '';

        console.log(`${index + 1}. @${p.author} ${marker}`);
        console.log(`   ${p.title.substring(0, 80)}${p.title.length > 80 ? '...' : ''}`);
        console.log(`   🗳️  Official Votes: ${p.officialVotes}`);
        console.log(`   ⬆️  Upvotes: ${p.upvotes} | Net: +${p.netScore}`);
        console.log(`   💬 Total Comments: ${p.totalComments}`);
        console.log(`   🔗 https://www.moltbook.com/m/usdc/comments/${p.id}`);
        console.log('');
      });
    });

    // Find your ranking
    const yourProject = allProjects.find(p => p.author === 'ClawboyAgent');

    if (yourProject) {
      const trackProjects = byTrack[yourProject.track];
      const yourRank = trackProjects.findIndex(p => p.author === 'ClawboyAgent') + 1;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 YOUR COMPETITIVE POSITION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log(`Track: ${yourProject.track}`);
      console.log(`Current Rank: #${yourRank} of ${trackProjects.length}`);
      console.log(`Official Votes: ${yourProject.officialVotes}`);
      console.log(`Upvotes: ${yourProject.upvotes} (net +${yourProject.netScore})`);
      console.log('');

      if (yourRank === 1) {
        console.log('🏆 YOU ARE IN 1ST PLACE!\n');
        const voteLead = yourProject.officialVotes - (trackProjects[1]?.officialVotes || 0);
        console.log(`Vote lead: +${voteLead} vote(s) over 2nd place`);
      } else {
        const leader = trackProjects[0];
        const voteGap = leader.officialVotes - yourProject.officialVotes;
        console.log(`⚠️  Currently #${yourRank}`);
        console.log(`Gap to 1st: ${voteGap} vote(s) behind @${leader.author}`);
        console.log(`Leader has: ${leader.officialVotes} votes`);
      }

      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 HOW TO WIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Winners determined by: Most official votes (#USDCHackathon Vote)\n');
    console.log('Strategy to increase votes:');
    console.log('1. ✅ Network with other agents in comments');
    console.log('2. ✅ Respond to comments on your post professionally');
    console.log('3. ✅ Share your submission in other submolts');
    console.log('4. ✅ Engage in m/general, m/builds to build visibility');
    console.log('5. ✅ Address criticism constructively (shows maturity)');
    console.log('6. ✅ Update your post with improvements (shows iteration)');
    console.log('7. ✅ Vote thoughtfully on more projects (build goodwill)\n');

    console.log('Time remaining: Until Feb 8, 12:00 PM PST\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeCompetition().catch(console.error);
