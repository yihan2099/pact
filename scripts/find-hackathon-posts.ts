#!/usr/bin/env bun

/**
 * Find all hackathon posts in m/usdc to vote on
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

async function findHackathonPosts() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 FINDING HACKATHON PROJECTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const profile = await moltbookRequest('/agents/me');
    const myPostId = '224fbb54-14ea-4d21-8efe-067521c54300';

    console.log('Searching through recent posts in m/usdc...\n');

    const allHackathonPosts: any[] = [];
    let offset = 0;
    const limit = 50;

    // Search through multiple pages
    for (let page = 0; page < 10; page++) {
      const posts = await moltbookRequest(`/posts?sort=new&limit=${limit}&offset=${offset}`);

      if (!posts.posts || posts.posts.length === 0) {
        break;
      }

      const hackathonPosts = posts.posts.filter((post: any) =>
        post.submolt.name === 'usdc' &&
        (post.title.toLowerCase().includes('usdchackathon') ||
         post.title.toLowerCase().includes('hackathon') ||
         post.content?.toLowerCase().includes('#usdchackathon projectsubmission'))
      );

      allHackathonPosts.push(...hackathonPosts);

      console.log(`  Page ${page + 1}: Found ${hackathonPosts.length} hackathon posts`);

      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Total hackathon posts found: ${allHackathonPosts.length}\n`);

    // Filter out your own post
    const otherPosts = allHackathonPosts.filter(post => post.id !== myPostId);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 HACKATHON PROJECTS TO VOTE ON');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Found ${otherPosts.length} projects (excluding yours):\n`);

    // Group by track
    const byTrack: Record<string, any[]> = {
      AgenticCommerce: [],
      SmartContract: [],
      Skill: [],
      Unknown: [],
    };

    otherPosts.forEach(post => {
      if (post.title.includes('AgenticCommerce')) {
        byTrack.AgenticCommerce.push(post);
      } else if (post.title.includes('SmartContract')) {
        byTrack.SmartContract.push(post);
      } else if (post.title.includes('Skill')) {
        byTrack.Skill.push(post);
      } else {
        byTrack.Unknown.push(post);
      }
    });

    // Display by track
    Object.entries(byTrack).forEach(([track, posts]) => {
      if (posts.length > 0) {
        console.log(`\n━━━ ${track} Track (${posts.length} projects) ━━━\n`);

        posts.forEach((post, index) => {
          console.log(`${index + 1}. @${post.author.name}`);
          console.log(`   ${post.title.substring(0, 100)}${post.title.length > 100 ? '...' : ''}`);
          console.log(`   📊 ${post.upvotes} upvotes | 💬 ${post.comment_count} comments`);
          console.log(`   🔗 https://www.moltbook.com/m/usdc/comments/${post.id}`);
          console.log('');
        });
      }
    });

    if (otherPosts.length === 0) {
      console.log('⚠️  No other hackathon submissions found yet.');
      console.log('   Check back later as more submissions come in.\n');
    } else if (otherPosts.length < 5) {
      console.log(`⚠️  Only ${otherPosts.length} other project(s) found so far.`);
      console.log(`   You need to vote on 5 projects, but there are only ${otherPosts.length} available.`);
      console.log('   Vote on all available projects now, and check back for more.\n');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ ACTION STEPS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('1. Pick 5 projects from the list above');
      console.log('2. Visit each project URL');
      console.log('3. Read their submission carefully');
      console.log('4. Comment with:');
      console.log('');
      console.log('   #USDCHackathon Vote');
      console.log('');
      console.log('   [Specific, thoughtful feedback about what you like]');
      console.log('');
      console.log('💡 Tips:');
      console.log('   - Be genuine and specific (not generic praise)');
      console.log('   - Mention specific features or approaches you appreciate');
      console.log('   - Vote across different tracks for variety');
      console.log('   - Build goodwill in the community\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findHackathonPosts().catch(console.error);
