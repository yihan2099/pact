#!/usr/bin/env bun

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const MY_POST_ID = '224fbb54-14ea-4d21-8efe-067521c54300';
const ROSE_POST_ID = '7dd09bff-412f-475f-8a1c-997a069dac1b';

async function moltbookRequest(endpoint: string) {
  const response = await fetch(`https://www.moltbook.com/api/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏆 AGENTICCOMMERCE TRACK COMPARISON');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check Rose Protocol
const roseData = await moltbookRequest(`/posts/${ROSE_POST_ID}`);
const roseComments = roseData.comments || [];
const roseVotes = roseComments.filter((c: any) =>
  c.content && c.content.includes('#USDCHackathon Vote')
);
const roseUniqueVoters = new Set(roseVotes.map((v: any) => v.author.name));

// Check your post
const myData = await moltbookRequest(`/posts/${MY_POST_ID}`);
const myComments = myData.comments || [];
const myVotes = myComments.filter((c: any) =>
  c.content && c.content.includes('#USDCHackathon Vote')
);
const myUniqueVoters = new Set(myVotes.map((v: any) => v.author.name));

console.log('📊 ROSE PROTOCOL (Competitor):');
console.log(`   URL: https://www.moltbook.com/post/${ROSE_POST_ID}`);
console.log(`   Upvotes: ${roseData.upvotes} (doesn't count for hackathon)`);
console.log(`   Total comments: ${roseData.comment_count}`);
console.log(`   Vote comments: ${roseVotes.length}`);
console.log(`   UNIQUE VOTERS: ${roseUniqueVoters.size}\n`);

console.log('📊 CLAWBOYAGENT (You):');
console.log(`   URL: https://www.moltbook.com/post/${MY_POST_ID}`);
console.log(`   Upvotes: ${myData.upvotes} (doesn't count for hackathon)`);
console.log(`   Total comments: ${myData.comment_count}`);
console.log(`   Vote comments: ${myVotes.length}`);
console.log(`   UNIQUE VOTERS: ${myUniqueVoters.size}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 HEAD-TO-HEAD (What Actually Counts)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('╔════════════════════════════════════════╗');
console.log('║    ClawboyAgent vs Rose Protocol       ║');
console.log('╠════════════════════════════════════════╣');
console.log(`║ Official Votes:  ${myUniqueVoters.size.toString().padEnd(4)} vs ${roseUniqueVoters.size.toString().padStart(4)}          ║`);
console.log(`║ Lead:            +${(myUniqueVoters.size - roseUniqueVoters.size).toString().padEnd(4)} votes         ║`);
console.log('╚════════════════════════════════════════╝\n');

const lead = myUniqueVoters.size - roseUniqueVoters.size;

if (lead > 0) {
  console.log(`✅ YOU ARE WINNING by ${lead} votes!\n`);
} else if (lead === 0) {
  console.log(`⚠️  TIED at ${myUniqueVoters.size} votes each!\n`);
} else {
  console.log(`❌ BEHIND by ${Math.abs(lead)} votes\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 KEY INSIGHT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`Rose has ${roseData.upvotes} upvotes vs your ${myData.upvotes} upvotes.`);
console.log('BUT upvotes DON\'T COUNT for hackathon!\n');

console.log(`What counts: Official vote COMMENTS with "#USDCHackathon Vote"`);
console.log(`You: ${myUniqueVoters.size} unique voters`);
console.log(`Rose: ${roseUniqueVoters.size} unique voters\n`);

if (roseUniqueVoters.size > 0) {
  console.log(`Rose Protocol voters:`);
  const roseVotersList = Array.from(roseUniqueVoters).slice(0, 10);
  for (const voter of roseVotersList) {
    console.log(`  • @${voter}`);
  }
  if (roseUniqueVoters.size > 10) {
    console.log(`  ... and ${roseUniqueVoters.size - 10} more`);
  }
  console.log('');
}
