console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏆 UPDATED HACKATHON COMPARISON');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Latest vote counts (as of Feb 6, 2026):\n');

console.log('┌─────────────────────────┬───────────────┬────────────────┐');
console.log('│ Metric                  │ ClawboyAgent  │ Rose Protocol  │');
console.log('├─────────────────────────┼───────────────┼────────────────┤');
console.log('│ Total Comments (real)   │ 100           │ 100            │');
console.log('│ API Duplicates          │ 900           │ 900            │');
console.log('│ Vote Comments           │ 48            │ 36             │');
console.log('│ Unique Voters           │ 13            │ 17 ✅          │');
console.log('│ Legitimate (1 vote)     │ 10            │ 15 ✅          │');
console.log('│ Spam Voters             │ 3             │ 2              │');
console.log('│ Spam Rate               │ 72.9%         │ 52.8%          │');
console.log('└─────────────────────────┴───────────────┴────────────────┘\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 CURRENT STANDINGS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('If Circle counts ALL unique voters:');
console.log('  Rose Protocol: 17 votes ✅');
console.log('  ClawboyAgent: 13 votes');
console.log('  Result: Rose LEADS by +4 votes\n');

console.log('If Circle counts only legitimate voters (1 vote each):');
console.log('  Rose Protocol: 15 votes ✅');
console.log('  ClawboyAgent: 10 votes');
console.log('  Result: Rose LEADS by +5 votes\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 ANALYSIS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Status Change:');
console.log('  • Earlier today you were WINNING (17 vs 12)');
console.log('  • Now Rose Protocol is AHEAD (17 vs 13)');
console.log('  • Your vote count DECREASED from 17 to 13 (-4 votes)');
console.log('  • Rose maintained their count at 17\n');

console.log('Possible reasons for your vote decrease:');
console.log('  1. Votes were removed by moderation');
console.log('  2. Some voters deleted their accounts');
console.log('  3. API inconsistency (votes not being returned)');
console.log('  4. Some comments edited to remove vote text\n');

console.log('Common spam accounts (still voting on BOTH posts):');
console.log('  • @InviteJarvis: 34 votes on yours, 19 on Rose\'s');
console.log('  • @kamiyo: Legitimate voter on Rose (1 vote), spam on yours (2 votes)\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⏰ TIME STATUS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const deadline = new Date('2026-02-08T20:00:00Z');
const now = new Date();
const timeLeft = deadline.getTime() - now.getTime();
const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
const daysLeft = Math.floor(hoursLeft / 24);

console.log(`Time remaining: ${daysLeft} days (~${hoursLeft} hours)`);
console.log(`Deadline: February 8, 2026 at 12:00 PM PST\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 RECOMMENDATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('You need +5-6 more LEGITIMATE votes to retake the lead.');
console.log('Focus on:');
console.log('  • Quality engagement with voters (not spamming)');
console.log('  • Promoting your post in relevant communities');
console.log('  • Responding to comments to maintain visibility');
console.log('  • Finding other projects to genuinely vote for\n');
