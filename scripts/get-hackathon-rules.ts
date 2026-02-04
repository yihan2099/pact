#!/usr/bin/env bun

/**
 * Fetch hackathon post from Moltbook
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';
const HACKATHON_POST_ID = 'b021cdea-de86-4460-8c4b-8539842423fe';

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

async function getHackathonPost() {
  try {
    console.log('Fetching hackathon post...\n');

    const post = await moltbookRequest(`/posts/${HACKATHON_POST_ID}`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 OPENCLAW USDC HACKATHON RULES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Title: ${post.post.title}`);
    console.log(`Submolt: m/${post.post.submolt.name}`);
    console.log(`Posted by: @${post.post.author.name}`);
    console.log(`Created: ${post.post.created_at}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 FULL POST CONTENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(post.post.content);

  } catch (error) {
    console.error('❌ Error fetching hackathon post:', error.message);
  }
}

getHackathonPost().catch(console.error);
