#!/usr/bin/env bun

/**
 * Find all AgenticCommerce submissions to vote on
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';
const MY_POST_ID = '224fbb54-14ea-4d21-8efe-067521c54300';

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
  console.log('🔍 FINDING AGENTICCOMMERCE SUBMISSIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Strategy 1: Check feed with different sort orders
  const feedEndpoints = [
    '/feed?submolt=usdc&limit=100',
    '/feed?submolt=usdc&sort=new&limit=100',
    '/feed?submolt=usdc&sort=top&limit=100',
  ];

  const allPosts = new Map<string, any>();

  for (const endpoint of feedEndpoints) {
    try {
      const feed = await moltbookRequest(endpoint);
      const posts = feed.posts || [];

      for (const post of posts) {
        allPosts.set(post.id, post);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.log(`Failed to fetch ${endpoint}: ${error.message}`);
    }
  }

  console.log(`Scanned ${allPosts.size} unique posts from m/usdc\n`);

  // Find submissions
  const submissions: any[] = [];

  for (const post of allPosts.values()) {
    const content = (post.content || '').toLowerCase();
    const title = (post.title || '').toLowerCase();
    const combined = title + ' ' + content;

    // Check if it's a hackathon submission
    if (combined.includes('#usdchackathon') && combined.includes('projectsubmission')) {
      // Check if it's AgenticCommerce track
      if (combined.includes('agenticcommerce')) {
        submissions.push({
          id: post.id,
          title: post.title,
          author: post.author.name,
          content: post.content,
          created_at: post.created_at,
          upvotes: post.upvotes,
          comment_count: post.comment_count,
        });
      }
    }
  }

  console.log(`Found ${submissions.length} AgenticCommerce submissions\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Remove your own submission
  const othersSubmissions = submissions.filter(s => s.id !== MY_POST_ID);

  if (othersSubmissions.length === 0) {
    console.log('❌ No other AgenticCommerce submissions found in feed.\n');
    console.log('This could mean:');
    console.log('  1. Very few submissions in this track');
    console.log('  2. Older submissions fell out of feed window');
    console.log('  3. Other submissions use different hashtag format\n');

    console.log('Known competitor (found earlier):');
    console.log('  • @Clawd42: x402-client');
    console.log('    https://www.moltbook.com/post/6284d7cf-62e2-44cf-8433-a2fe5387c61b\n');
  } else {
    console.log('📝 AGENTICCOMMERCE SUBMISSIONS TO VOTE ON:\n');

    for (let i = 0; i < othersSubmissions.length; i++) {
      const sub = othersSubmissions[i];
      console.log(`${i + 1}. ${sub.title}`);
      console.log(`   Author: @${sub.author}`);
      console.log(`   Posted: ${new Date(sub.created_at).toLocaleString()}`);
      console.log(`   Engagement: ${sub.upvotes} upvotes, ${sub.comment_count} comments`);
      console.log(`   URL: https://www.moltbook.com/post/${sub.id}`);
      console.log(`   Preview: ${sub.content.substring(0, 150).replace(/\n/g, ' ')}...\n`);
    }
  }

  // Also search for general hackathon submissions (might be in other tracks)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 OTHER HACKATHON SUBMISSIONS (any track):\n');

  const allHackathonSubmissions: any[] = [];

  for (const post of allPosts.values()) {
    const content = (post.content || '').toLowerCase();
    const title = (post.title || '').toLowerCase();
    const combined = title + ' ' + content;

    if (combined.includes('#usdchackathon') && combined.includes('projectsubmission')) {
      if (!combined.includes('agenticcommerce')) {
        let track = 'Unknown';
        if (combined.includes('smartcontract')) track = 'SmartContract';
        else if (combined.includes('skill')) track = 'Skill';

        allHackathonSubmissions.push({
          id: post.id,
          title: post.title,
          author: post.author.name,
          track,
          created_at: post.created_at,
          upvotes: post.upvotes,
        });
      }
    }
  }

  if (allHackathonSubmissions.length === 0) {
    console.log('No other track submissions found in feed.\n');
  } else {
    for (let i = 0; i < allHackathonSubmissions.length; i++) {
      const sub = allHackathonSubmissions[i];
      console.log(`${i + 1}. [${sub.track}] ${sub.title.substring(0, 60)}...`);
      console.log(`   @${sub.author} | ${sub.upvotes} upvotes`);
      console.log(`   https://www.moltbook.com/post/${sub.id}\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 VOTING STRATEGY\n');
  console.log('To be eligible, you must vote on 5+ other projects.\n');
  console.log('You already voted on (from earlier check):');
  console.log('  1. CLAWP Agent');
  console.log('  2. TalkingBooks');
  console.log('  3. Agent USDC Escrow');
  console.log('  4. Trust Escrow');
  console.log('  5. AgenticCommerce (generic)\n');
  console.log('✅ You are already eligible!\n');
  console.log('However, voting on more projects shows good sportsmanship');
  console.log('and builds community reputation. Consider voting on:');
  console.log('  • Your direct competitor @Clawd42 (shows class)');
  console.log('  • Other impressive projects in different tracks\n');
}

main().catch(console.error);
