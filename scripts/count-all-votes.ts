#!/usr/bin/env bun

/**
 * Count votes on all known hackathon projects including from user's voting history
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

// Known projects from user's votes + initial search
const KNOWN_PROJECTS = [
  // ClawboyAgent's project
  { id: '224fbb54-14ea-4d21-8efe-067521c54300', author: 'ClawboyAgent', title: 'Clawboy', track: 'AgenticCommerce' },

  // From user's votes
  { id: null, author: 'Unknown', title: 'CLAWP Agent', track: 'AgenticCommerce' },
  { id: null, author: 'Unknown', title: 'TalkingBooks', track: 'AgenticCommerce' },
  { id: null, author: 'Unknown', title: 'Agent USDC Escrow', track: 'AgenticCommerce' },
  { id: null, author: 'Unknown', title: 'Trust Escrow', track: 'AgenticCommerce' },
  { id: null, author: 'Unknown', title: 'Agent Mutual Insurance', track: 'AgenticCommerce' },

  // From earlier searches
  { id: '89845625-56bf-4d32-b4cb-c9a593522963', author: 'Claudine_cw', title: 'TaskMarket', track: 'AgenticCommerce' },
  { id: '30cbdc23-604e-4851-a2a7-799c1ccf9ef5', author: 'W3Cash', title: 'W3Cash Flows SDK', track: 'Skill' },
  { id: '1b600a00-c049-4036-bde6-bfddbb4e9ca2', author: 'OpenClaw_0Z', title: 'USDC Multi-Chain Tracker', track: 'Skill' },
  { id: 'db94c2df-6aa5-49b3-a682-05f9def4b1b9', author: 'LobsterAgentUK', title: 'LobsterAgent Skill', track: 'Skill' },
];

async function moltbookRequest<T = any>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}`, 'Content-Type': 'application/json' }
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function countVotes(postId: string): Promise<number> {
  try {
    const commentsData = await moltbookRequest(`/posts/${postId}/comments?sort=new`);
    const comments = commentsData.comments || [];
    return comments.filter((c: any) => c.content.includes('#USDCHackathon Vote')).length;
  } catch {
    return -1;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗳️  VOTE COUNT ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: any[] = [];

  for (const project of KNOWN_PROJECTS) {
    if (!project.id) continue;

    console.log(`Checking @${project.author} (${project.title})...`);
    const votes = await countVotes(project.id);

    if (votes >= 0) {
      results.push({ ...project, votes });
      console.log(`  ${votes} vote(s)\n`);
    } else {
      console.log(`  Error fetching\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 400));
  }

  // Group by track
  const byTrack: Record<string, any[]> = {};
  results.forEach(r => {
    if (!byTrack[r.track]) byTrack[r.track] = [];
    byTrack[r.track].push(r);
  });

  // Sort by votes
  Object.keys(byTrack).forEach(track => {
    byTrack[track].sort((a, b) => b.votes - a.votes);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏆 LEADERBOARD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  Object.entries(byTrack).forEach(([track, projects]) => {
    console.log(`━━━ ${track} Track ━━━\n`);

    projects.forEach((p, i) => {
      const marker = p.author === 'ClawboyAgent' ? ' 👉 YOU' : '';
      console.log(`${i + 1}. @${p.author}${marker}`);
      console.log(`   ${p.title}`);
      console.log(`   🗳️  ${p.votes} official vote(s)`);
      console.log('');
    });
  });

  const yourProject = results.find(r => r.author === 'ClawboyAgent');
  if (yourProject) {
    const trackProjects = byTrack[yourProject.track];
    const rank = trackProjects.findIndex(p => p.author === 'ClawboyAgent') + 1;
    const leader = trackProjects[0];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 YOUR POSITION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Track: ${yourProject.track}`);
    console.log(`Rank: #${rank} of ${trackProjects.length}`);
    console.log(`Your votes: ${yourProject.votes}`);

    if (rank === 1) {
      const voteLead = yourProject.votes - (trackProjects[1]?.votes || 0);
      console.log(`\n🏆 YOU'RE IN 1ST PLACE!`);
      console.log(`Lead: +${voteLead} vote(s) over 2nd place\n`);
    } else {
      const gap = leader.votes - yourProject.votes;
      console.log(`\n⚠️  Gap to 1st: ${gap} vote(s) behind @${leader.author}`);
      console.log(`Leader has: ${leader.votes} votes\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 HOW TO WIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (rank === 1) {
      console.log('Strategy: Maintain lead\n');
      console.log('1. Keep engaging with comments on your post');
      console.log('2. Respond to criticism professionally');
      console.log('3. Monitor competitors for vote increases');
      console.log('4. Consider minor improvements to show iteration');
    } else {
      console.log(`Strategy: Close ${gap}-vote gap\n`);
      console.log('1. Engage more actively in m/general, m/builds');
      console.log('2. Respond thoughtfully to ALL comments on your post');
      console.log('3. Share your submission in other communities');
      console.log('4. Network with agents who voted for competitors');
      console.log('5. Address criticism by updating your post');
    }

    console.log('\nTime left: Until Feb 8, 12:00 PM PST\n');
  }
}

main().catch(console.error);
