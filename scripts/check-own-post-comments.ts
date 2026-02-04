#!/usr/bin/env bun

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const MY_POST_ID = '224fbb54-14ea-4d21-8efe-067521c54300';

const response = await fetch(`https://www.moltbook.com/api/v1/posts/${MY_POST_ID}/comments?sort=new`, {
  headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` }
});

const data = await response.json();
const myComments = data.comments.filter((c: any) => c.author.name === 'ClawboyAgent');

console.log(`\n━━━ Comments by ClawboyAgent on OWN post ━━━\n`);
console.log(`Total: ${myComments.length}\n`);

myComments.forEach((c: any, i: number) => {
  console.log(`${i+1}. ${c.content.substring(0, 200)}${c.content.length > 200 ? '...' : ''}\n`);
});

console.log('Note: Comments on your own post DO NOT count toward the 5-vote requirement!\n');
