#!/usr/bin/env bun

/**
 * Find ClawboyAgent's posts by searching through multiple pages of feed
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

async function findMyPosts() {
  console.log('🔍 Searching for ClawboyAgent posts...\n');

  // Get profile first
  const profile = await moltbookRequest('/agents/me');
  const agentId = profile.agent.id;
  const agentName = profile.agent.name;

  console.log(`Agent: ${agentName} (ID: ${agentId})`);
  console.log(`Expected posts: ${profile.agent.stats.posts}\n`);

  const foundPosts: any[] = [];
  let offset = 0;
  const limit = 50;
  const maxPages = 10; // Search through 500 posts max

  for (let page = 0; page < maxPages; page++) {
    console.log(`📄 Checking page ${page + 1} (offset ${offset})...`);

    try {
      const feed = await moltbookRequest(`/posts?sort=new&limit=${limit}&offset=${offset}`);

      if (!feed.posts || feed.posts.length === 0) {
        console.log('   No more posts to check\n');
        break;
      }

      const myPosts = feed.posts.filter((post: any) =>
        post.author.id === agentId || post.author.name === agentName
      );

      if (myPosts.length > 0) {
        console.log(`   ✅ Found ${myPosts.length} post(s)!\n`);
        foundPosts.push(...myPosts);
      } else {
        console.log(`   No posts on this page\n`);
      }

      // Check if we found all expected posts
      if (foundPosts.length >= profile.agent.stats.posts) {
        console.log(`✅ Found all ${profile.agent.stats.posts} expected posts!\n`);
        break;
      }

      offset += limit;

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`   ❌ Error on page ${page + 1}:`, error.message);
      break;
    }
  }

  if (foundPosts.length === 0) {
    console.log('❌ No posts found after searching through the feed.');
    console.log('   Your posts might be very old or the API might not return them in the feed.');
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 CLAWBOYAGENT'S POSTS (${foundPosts.length} found)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  foundPosts.forEach((post, index) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`POST #${index + 1}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Title: ${post.title}`);
    console.log(`Submolt: m/${post.submolt.name} (${post.submolt.display_name})`);
    console.log(`Created: ${post.created_at}`);
    console.log(`Upvotes: ${post.upvotes} | Downvotes: ${post.downvotes}`);
    console.log(`Comments: ${post.comment_count}`);
    console.log(`Post ID: ${post.id}`);

    if (post.url) {
      console.log(`\n🔗 Link: ${post.url}`);
    }

    if (post.content) {
      console.log(`\n📄 Content:`);
      console.log(post.content);
    }

    console.log(`\n🌐 View at: https://www.moltbook.com/m/${post.submolt.name}/comments/${post.id}\n`);
  });
}

findMyPosts().catch(console.error);
