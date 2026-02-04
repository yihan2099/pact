#!/usr/bin/env bun

/**
 * Search for all hackathon submissions using different search strategies
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

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

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 FINDING ALL HACKATHON SUBMISSIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Strategy 1: Get recent feed and look for any hackathon-related content
  console.log('Strategy 1: Scanning m/usdc feed...\n');
  const feed = await moltbookRequest('/feed?submolt=usdc&limit=100');
  const posts = feed.posts || [];

  console.log(`Fetched ${posts.length} posts\n`);

  // Look for various hackathon-related patterns
  const hackathonPosts: any[] = [];

  for (const post of posts) {
    const content = post.content || '';
    const title = post.title || '';
    const combined = (title + ' ' + content).toLowerCase();

    if (
      combined.includes('hackathon') ||
      combined.includes('#usdchackathon') ||
      combined.includes('projectsubmission') ||
      combined.includes('10,000 usdc') ||
      combined.includes('prize pool')
    ) {
      hackathonPosts.push(post);
    }
  }

  console.log(`Found ${hackathonPosts.length} hackathon-related posts\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Categorize
  const submissions: any[] = [];
  const votes: any[] = [];
  const other: any[] = [];

  for (const post of hackathonPosts) {
    const content = post.content || '';
    const title = post.title || '';

    if (content.includes('ProjectSubmission') || title.includes('ProjectSubmission')) {
      submissions.push(post);
    } else if (content.includes('#USDCHackathon Vote')) {
      votes.push(post);
    } else {
      other.push(post);
    }
  }

  console.log('📊 CATEGORIZATION:\n');
  console.log(`Project Submissions: ${submissions.length}`);
  console.log(`Vote comments: ${votes.length}`);
  console.log(`Other hackathon posts: ${other.length}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📝 PROJECT SUBMISSIONS:\n');

  if (submissions.length === 0) {
    console.log('❌ No project submissions found.\n');
    console.log('Possible reasons:');
    console.log('  1. Submissions use different hashtag format');
    console.log('  2. Submissions are in comments, not posts');
    console.log('  3. Feed pagination missed them');
    console.log('  4. Very few actual submissions yet\n');

    console.log('Let me check YOUR submission as reference...\n');

    const myPostId = '224fbb54-14ea-4d21-8efe-067521c54300';
    const myPost = await moltbookRequest(`/posts/${myPostId}`);
    const myContent = myPost.post?.content || myPost.content || '';

    console.log('Your submission format:\n');
    console.log(myContent.substring(0, 300));
    console.log('\n...\n');

    // Check if your post appears in the feed
    const foundInFeed = posts.find((p: any) => p.id === myPostId);
    console.log(`Your post in feed: ${foundInFeed ? 'YES' : 'NO'}\n`);
  } else {
    // Show all submissions
    for (const post of submissions) {
      console.log(`📝 ${post.title || 'Untitled'}`);
      console.log(`   Author: @${post.author.name}`);
      console.log(`   ID: ${post.id}`);
      console.log(`   URL: https://www.moltbook.com/post/${post.id}`);
      console.log(`   Preview: ${post.content.substring(0, 150)}...\n`);
      console.log('───────────────────────────────────────────\n');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 OTHER HACKATHON POSTS:\n');

  for (const post of other.slice(0, 10)) {
    console.log(`• @${post.author.name}: ${post.title || post.content.substring(0, 60)}...`);
  }
}

main().catch(console.error);
