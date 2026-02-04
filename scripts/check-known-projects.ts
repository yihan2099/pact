#!/usr/bin/env bun

/**
 * Check the 4 known hackathon projects for ClawboyAgent votes
 */

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE_URL = 'https://www.moltbook.com/api/v1';

// Known hackathon project IDs
const HACKATHON_PROJECTS = [
  {
    id: '89845625-56bf-4d32-b4cb-c9a593522963',
    author: 'Claudine_cw',
    title: 'TaskMarket (AgenticCommerce)',
  },
  {
    id: '30cbdc23-604e-4851-a2a7-799c1ccf9ef5',
    author: 'W3Cash',
    title: 'W3Cash Flows SDK (Skill)',
  },
  {
    id: '1b600a00-c049-4036-bde6-bfddbb4e9ca2',
    author: 'OpenClaw_0Z',
    title: 'USDC Multi-Chain Tracker (Skill)',
  },
  {
    id: 'db94c2df-6aa5-49b3-a682-05f9def4b1b9',
    author: 'LobsterAgentUK',
    title: 'LobsterAgent Skill',
  },
];

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

async function checkKnownProjects() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING YOUR VOTES ON KNOWN PROJECTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const profile = await moltbookRequest('/agents/me');
    const agentName = profile.agent.name;
    const agentId = profile.agent.id;

    console.log(`Agent: ${agentName}\n`);

    const myVotes: any[] = [];

    for (const project of HACKATHON_PROJECTS) {
      console.log(`Checking @${project.author}'s project...`);

      try {
        const commentsData = await moltbookRequest(`/posts/${project.id}/comments?sort=new`);
        const comments = commentsData.comments || [];

        const myComments = comments.filter((comment: any) =>
          comment.author.id === agentId || comment.author.name === agentName
        );

        if (myComments.length > 0) {
          console.log(`  ✅ Found ${myComments.length} comment(s)\n`);

          myComments.forEach((comment: any) => {
            myVotes.push({
              project: project.title,
              projectAuthor: project.author,
              projectId: project.id,
              commentContent: comment.content,
              hasVoteHashtag: comment.content.includes('#USDCHackathon Vote'),
              commentTimestamp: comment.created_at,
            });
          });
        } else {
          console.log(`  ➖ No comments found\n`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const officialVotes = myVotes.filter(v => v.hasVoteHashtag);
    const commentsWithoutHashtag = myVotes.filter(v => !v.hasVoteHashtag);

    console.log(`Total comments on these projects: ${myVotes.length}`);
    console.log(`Official votes (#USDCHackathon Vote): ${officialVotes.length}`);
    console.log(`Comments without hashtag: ${commentsWithoutHashtag.length}\n`);

    if (officialVotes.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ OFFICIAL VOTES FOUND');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      officialVotes.forEach((vote, index) => {
        console.log(`${index + 1}. Vote on: ${vote.project}`);
        console.log(`   By: @${vote.projectAuthor}`);
        console.log(`   Timestamp: ${vote.commentTimestamp}`);
        console.log(`   Comment:\n   "${vote.commentContent.substring(0, 200)}${vote.commentContent.length > 200 ? '...' : ''}"`);
        console.log('');
      });
    }

    if (commentsWithoutHashtag.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  COMMENTS WITHOUT HASHTAG (Won\'t Count!)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      commentsWithoutHashtag.forEach((comment, index) => {
        console.log(`${index + 1}. Comment on: ${comment.project}`);
        console.log(`   By: @${comment.projectAuthor}`);
        console.log(`   ❌ Missing: #USDCHackathon Vote`);
        console.log(`   Comment: "${comment.commentContent.substring(0, 150)}${comment.commentContent.length > 150 ? '...' : ''}"`);
        console.log('');
      });

      console.log('💡 These comments need the hashtag to count as official votes!');
      console.log('   You may be able to edit them to add: #USDCHackathon Vote\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 ELIGIBILITY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (officialVotes.length >= 5) {
      console.log(`✅ ELIGIBLE: ${officialVotes.length} official votes`);
    } else if (officialVotes.length > 0) {
      console.log(`⚠️  PARTIAL: ${officialVotes.length} official vote(s)`);
      console.log(`   Need ${5 - officialVotes.length} more to be eligible`);
    } else {
      console.log(`❌ NOT ELIGIBLE: 0 official votes`);
      console.log(`   Need 5 votes with #USDCHackathon Vote hashtag`);
    }

    if (myVotes.length > 0 && officialVotes.length < myVotes.length) {
      console.log(`\n💡 You have ${myVotes.length} comment(s) but only ${officialVotes.length} have the hashtag.`);
      console.log(`   Try editing your comments to add: #USDCHackathon Vote`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkKnownProjects().catch(console.error);
