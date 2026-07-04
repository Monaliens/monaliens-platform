const cron = require('node-cron');
const AirdropManager = require('./airdrop');

console.log('  LMON Airdrop Scheduler started');
console.log(`Start time: ${new Date().toISOString()}`);

// Airdrop manager instance
const manager = new AirdropManager();

// Schedule for every hour to check if today's airdrop is done
// Format: '0 * * * *' = every hour at minute 0
const SCHEDULE = '0 * * * *'; // Check every hour

// For testing - run every minute
// const SCHEDULE = '* * * * *';

console.log(`Schedule: ${SCHEDULE}`);
console.log('   (Hourly check - has today\'s airdrop been done?)\n');

// Check if airdrop needs to run today on startup
async function checkAndRunInitialAirdrop() {
    console.log(' Checking if airdrop has been done today...');

    try {
        const canRun = await manager.canRunAirdrop();
        if (canRun) {
            console.log(' Airdrop not done today! Starting now...\n');
            await manager.run(false); // false = production mode
        } else {
            const state = await manager.loadState();
            console.log(' Airdrop already done today.');
            if (state.lastAirdrop) {
                console.log(`   Last airdrop: ${new Date(state.lastAirdrop).toISOString()}`);
            }
        }
    } catch (error) {
        console.error(' Initial check error:', error);
    }

    console.log('\n Next automatic airdrop: Tomorrow 00:00 UTC\n');
}

// Run initial check
checkAndRunInitialAirdrop();

// Schedule the task
const task = cron.schedule(SCHEDULE, async () => {
    console.log('\nHourly check triggered!');
    console.log(`   Time: ${new Date().toISOString()}`);

    try {
        const canRun = await manager.canRunAirdrop();
        if (canRun) {
            console.log(' Airdrop not done today! Starting...');
            await manager.run(false); // false = production mode
        } else {
            console.log(" Today's airdrop already done.");
            const state = await manager.loadState();
            if (state.lastAirdrop) {
                console.log(`   Last airdrop: ${new Date(state.lastAirdrop).toISOString()}`);
            }
            console.log('   Next check: in 1 hour');
        }
    } catch (error) {
        console.error(' Hourly check error:', error);
        console.log('   Next retry: in 1 hour');
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Start the scheduler
task.start();

console.log('Scheduler active and monitoring...');
console.log(' Tip: For testing use "npm test" or "node airdrop.js --test"');
console.log(' Press Ctrl+C to stop\n');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nStopping scheduler...');
    task.stop();
    process.exit(0);
});