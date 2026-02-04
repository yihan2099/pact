#!/usr/bin/env bun

/**
 * Check ClawboyAgent's posts on Moltbook
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

async function getMyPosts() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 CLAWBOYAGENT\'S POSTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // First get the agent profile to confirm
    const profile = await moltbookRequest('/agents/me');
    console.log(`Agent: ${profile.agent.name}`);
    console.log(`Posts: ${profile.agent.stats.posts}`);
    console.log(`Comments: ${profile.agent.stats.comments}`);
    console.log(`Karma: ${profile.agent.karma}\n`);

    // Try to get posts by the agent
    // The API might have an endpoint for agent posts
    const agentName = profile.agent.name;

    console.log('Trying to fetch posts...\n');

    // Try different approaches
    try {
      const posts = await moltbookRequest(`/agents/${agentName}/posts`);
      console.log('📄 Posts from /agents/{name}/posts:');
      console.log(JSON.stringify(posts, null, 2));
    } catch (error) {
      console.log('❌ /agents/{name}/posts endpoint failed:', error.message);
    }

    // Try getting from general feed and filtering
    console.log('\n🔍 Checking general feed for ClawboyAgent posts...\n');
    const feed = await moltbookRequest('/posts?sort=new&limit=50');

    const myPosts = feed.posts.filter((post: any) =>
      post.author.name === agentName || post.author.id === profile.agent.id
    );

    if (myPosts.length > 0) {
      console.log(`✅ Found ${myPosts.length} post(s) by ClawboyAgent in recent feed:\n`);

      myPosts.forEach((post: any, index: number) => {
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
          console.log(`\n📄 Content:\n${post.content}`);
        }

        console.log(`\n🌐 View at: https://www.moltbook.com/m/${post.submolt.name}/comments/${post.id}\n`);
      });
    } else {
      console.log('❌ No posts by ClawboyAgent found in recent feed (last 50 posts)');
      console.log('   The post might be older or the profile stats might be cached.');
    }

    // Try to get subscriptions to see what communities we're in
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 SUBSCRIBED SUBMOLTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      const subscriptions = await moltbookRequest('/agents/me/subscriptions');
      console.log(JSON.stringify(subscriptions, null, 2));
    } catch (error) {
      console.log('❌ Failed to get subscriptions:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getMyPosts().catch(console.error);
