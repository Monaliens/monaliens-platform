/**
 * Script to update existing raffles with formatted values
 * Run this script once to update all existing raffles in the database
 */

const mongoose = require('mongoose');
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { getDatabaseUrl } = require('../config/config');
require('dotenv').config();

async function updateRaffles() {
  try {
    console.log(' Connecting to database...');
    const databaseUrl = getDatabaseUrl();
    await mongoose.connect(databaseUrl);
    console.log(' Connected to MongoDB');
    console.log(` Database: ${mongoose.connection.name}`);

    // Update raffles
    console.log(' Updating raffles...');
    const raffles = await Raffle.find({});
    
    for (const raffle of raffles) {
      // Add formatted values if they don't exist
      if (!raffle.prizeAmountFormatted && raffle.prizeAmount) {
        raffle.prizeAmountFormatted = Number(BigInt(raffle.prizeAmount) / BigInt(10**15)) / 1000;
      }
      
      if (!raffle.ticketPriceFormatted && raffle.ticketPrice) {
        raffle.ticketPriceFormatted = Number(BigInt(raffle.ticketPrice) / BigInt(10**15)) / 1000;
      }
      
      if (!raffle.totalRevenueFormatted && raffle.totalRevenue) {
        raffle.totalRevenueFormatted = Number(BigInt(raffle.totalRevenue) / BigInt(10**15)) / 1000;
      }
      
      await raffle.save();
      console.log(` Updated raffle ${raffle.raffleId}`);
    }
    
    // Update tickets
    console.log(' Updating tickets...');
    const tickets = await Ticket.find({});
    
    for (const ticket of tickets) {
      // Add formatted values if they don't exist
      if (!ticket.totalCostFormatted && ticket.totalCost) {
        ticket.totalCostFormatted = Number(BigInt(ticket.totalCost) / BigInt(10**15)) / 1000;
      }
      
      if (!ticket.ticketPriceFormatted && ticket.ticketPrice) {
        ticket.ticketPriceFormatted = Number(BigInt(ticket.ticketPrice) / BigInt(10**15)) / 1000;
      }
      
      await ticket.save();
      console.log(` Updated ticket for raffle ${ticket.raffleId} by ${ticket.owner}`);
    }
    
    // Update users
    console.log(' Updating users...');
    const users = await User.find({});
    
    for (const user of users) {
      // Convert string values to numbers if needed
      if (typeof user.stats.totalAmountSpent === 'string' && user.stats.totalAmountSpent !== '0') {
        try {
          const amountInWei = BigInt(user.stats.totalAmountSpent);
          user.stats.totalAmountSpent = Number(amountInWei / BigInt(10**15)) / 1000;
        } catch (error) {
          console.error(` Error converting totalAmountSpent for user ${user.address}:`, error.message);
          user.stats.totalAmountSpent = 0;
        }
      }
      
      if (typeof user.stats.totalPrizesWon === 'string' && user.stats.totalPrizesWon !== '0') {
        try {
          const prizesInWei = BigInt(user.stats.totalPrizesWon);
          user.stats.totalPrizesWon = Number(prizesInWei / BigInt(10**15)) / 1000;
        } catch (error) {
          console.error(` Error converting totalPrizesWon for user ${user.address}:`, error.message);
          user.stats.totalPrizesWon = 0;
        }
      }
      
      if (typeof user.staking.totalStaked === 'string' && user.staking.totalStaked !== '0') {
        try {
          const stakedInWei = BigInt(user.staking.totalStaked);
          user.staking.totalStaked = Number(stakedInWei / BigInt(10**15)) / 1000;
        } catch (error) {
          console.error(` Error converting totalStaked for user ${user.address}:`, error.message);
          user.staking.totalStaked = 0;
        }
      }
      
      if (typeof user.staking.totalRewardsEarned === 'string' && user.staking.totalRewardsEarned !== '0') {
        try {
          const rewardsInWei = BigInt(user.staking.totalRewardsEarned);
          user.staking.totalRewardsEarned = Number(rewardsInWei / BigInt(10**15)) / 1000;
        } catch (error) {
          console.error(` Error converting totalRewardsEarned for user ${user.address}:`, error.message);
          user.staking.totalRewardsEarned = 0;
        }
      }
      
      if (typeof user.referral.totalCommissionsEarned === 'string' && user.referral.totalCommissionsEarned !== '0') {
        try {
          const commissionsInWei = BigInt(user.referral.totalCommissionsEarned);
          user.referral.totalCommissionsEarned = Number(commissionsInWei / BigInt(10**15)) / 1000;
        } catch (error) {
          console.error(` Error converting totalCommissionsEarned for user ${user.address}:`, error.message);
          user.referral.totalCommissionsEarned = 0;
        }
      }
      
      await user.save();
      console.log(` Updated user ${user.address}`);
    }
    
    console.log(' All updates completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(' Error updating raffles:', error.message);
    process.exit(1);
  }
}

updateRaffles(); 