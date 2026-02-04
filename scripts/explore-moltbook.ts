#!/usr/bin/env bun

/**
 * Moltbook API Explorer
 *
 * This script explores the Moltbook API to understand:
 * - Agent profile and identity
 * - Available communities (submolts)
 * - Current feed content
 * - Platform capabilities
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

if (!MOLTBOOK_API_KEY) {
  console.error('❌ MOLTBOOK_API_KEY environment variable not found');
  process.exit(1);
}

interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
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

  console.log(`\n🌐 ${options.method || 'GET'} ${endpoint}`);

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

async function getAgentProfile() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 AGENT PROFILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const profile = await moltbookRequest('/agents/me');
    console.log(JSON.stringify(profile, null, 2));
    return profile;
  } catch (error) {
    console.error('❌ Failed to fetch agent profile:', error);
    return null;
  }
}

async function listSubmolts() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏘️  AVAILABLE SUBMOLTS (Communities)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const submolts = await moltbookRequest('/submolts?limit=20');

    if (Array.isArray(submolts)) {
      console.log(`\nFound ${submolts.length} submolts:\n`);
      submolts.forEach((submolt: any, index: number) => {
        console.log(`${index + 1}. m/${submolt.name}`);
        console.log(`   ${submolt.display_name || submolt.name}`);
        console.log(`   ${submolt.description || 'No description'}`);
        console.log(`   Members: ${submolt.member_count || 'N/A'} | Posts: ${submolt.post_count || 'N/A'}`);
        console.log('');
      });
    } else if (submolts.data && Array.isArray(submolts.data)) {
      console.log(`\nFound ${submolts.data.length} submolts:\n`);
      submolts.data.forEach((submolt: any, index: number) => {
        console.log(`${index + 1}. m/${submolt.name}`);
        console.log(`   ${submolt.display_name || submolt.name}`);
        console.log(`   ${submolt.description || 'No description'}`);
        console.log(`   Members: ${submolt.member_count || 'N/A'} | Posts: ${submolt.post_count || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('Response structure:', JSON.stringify(submolts, null, 2));
    }

    return submolts;
  } catch (error) {
    console.error('❌ Failed to fetch submolts:', error);
    return null;
  }
}

async function getFeed(sort: 'hot' | 'new' | 'top' | 'rising' = 'hot', limit = 10) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📰 FEED (${sort.toUpperCase()}, limit: ${limit})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const feed = await moltbookRequest(`/posts?sort=${sort}&limit=${limit}`);

    if (Array.isArray(feed)) {
      console.log(`\nFound ${feed.length} posts:\n`);
      feed.forEach((post: any, index: number) => {
        console.log(`${index + 1}. ${post.title}`);
        console.log(`   by u/${post.author?.name || 'unknown'} in m/${post.submolt}`);
        console.log(`   ⬆️  ${post.upvotes || 0} | 💬 ${post.comment_count || 0} comments`);
        if (post.url) {
          console.log(`   🔗 ${post.url}`);
        }
        if (post.content && post.content.length > 0) {
          const preview = post.content.substring(0, 100);
          console.log(`   ${preview}${post.content.length > 100 ? '...' : ''}`);
        }
        console.log('');
      });
    } else if (feed.data && Array.isArray(feed.data)) {
      console.log(`\nFound ${feed.data.length} posts:\n`);
      feed.data.forEach((post: any, index: number) => {
        console.log(`${index + 1}. ${post.title}`);
        console.log(`   by u/${post.author?.name || 'unknown'} in m/${post.submolt}`);
        console.log(`   ⬆️  ${post.upvotes || 0} | 💬 ${post.comment_count || 0} comments`);
        if (post.url) {
          console.log(`   🔗 ${post.url}`);
        }
        if (post.content && post.content.length > 0) {
          const preview = post.content.substring(0, 100);
          console.log(`   ${preview}${post.content.length > 100 ? '...' : ''}`);
        }
        console.log('');
      });
    } else {
      console.log('Response structure:', JSON.stringify(feed, null, 2));
    }

    return feed;
  } catch (error) {
    console.error('❌ Failed to fetch feed:', error);
    return null;
  }
}

async function searchContent(query: string, limit = 5) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔍 SEARCH: "${query}"`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const results = await moltbookRequest(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    console.log(JSON.stringify(results, null, 2));
    return results;
  } catch (error) {
    console.error('❌ Failed to search:', error);
    return null;
  }
}

async function generateIdentityToken() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 IDENTITY TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const token = await moltbookRequest('/agents/me/identity-token', {
      method: 'POST',
    });
    console.log('✅ Generated identity token (expires in 1 hour)');
    console.log(JSON.stringify(token, null, 2));
    return token;
  } catch (error) {
    console.error('❌ Failed to generate identity token:', error);
    return null;
  }
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🤖 MOLTBOOK API EXPLORER 🤖        ║');
  console.log('╚════════════════════════════════════════╝');

  const results = {
    profile: await getAgentProfile(),
    submolts: await listSubmolts(),
    feed_hot: await getFeed('hot', 5),
    feed_new: await getFeed('new', 5),
    search_ai: await searchContent('artificial intelligence', 3),
    search_web3: await searchContent('web3', 3),
    identity_token: await generateIdentityToken(),
  };

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n✅ Exploration complete!`);
  console.log(`Profile fetched: ${results.profile ? '✓' : '✗'}`);
  console.log(`Submolts listed: ${results.submolts ? '✓' : '✗'}`);
  console.log(`Hot feed fetched: ${results.feed_hot ? '✓' : '✗'}`);
  console.log(`New feed fetched: ${results.feed_new ? '✓' : '✗'}`);
  console.log(`AI search completed: ${results.search_ai ? '✓' : '✗'}`);
  console.log(`Web3 search completed: ${results.search_web3 ? '✓' : '✗'}`);
  console.log(`Identity token generated: ${results.identity_token ? '✓' : '✗'}`);

  console.log('\n💡 Next steps:');
  console.log('   - Review agent profile and capabilities');
  console.log('   - Explore relevant submolts for Clawboy');
  console.log('   - Consider posting about Clawboy tasks/bounties');
  console.log('   - Integrate with MCP server for agent discovery');
}

main().catch(console.error);
