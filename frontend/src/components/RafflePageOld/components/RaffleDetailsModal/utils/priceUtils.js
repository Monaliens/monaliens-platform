import { PARTICIPATION_CONFIG } from '../data/participationConfig';

// Calculate total cost for tickets
export const calculateTotalCost = (ticketPrice, quantity) => {
  if (!ticketPrice || !quantity) return 0;
  
  const price = parseFloat(ticketPrice) || 0;
  const qty = parseInt(quantity) || 0;
  
  return price * qty;
};

// Format price with specified decimal places
export const formatPrice = (price, decimalPlaces = PARTICIPATION_CONFIG.costCalculation.decimalPlaces) => {
  if (price === null || price === undefined) return '0';
  
  const numPrice = parseFloat(price) || 0;
  
  // For very large numbers (likely in wei), convert to ether
  if (numPrice >= 1e18) {
    const etherValue = numPrice / 1e18;
    // Use smart decimal places - fewer for larger numbers
    if (etherValue >= 1000) {
      return etherValue.toFixed(0);
    } else if (etherValue >= 100) {
      return etherValue.toFixed(1);
    } else if (etherValue >= 10) {
      return etherValue.toFixed(2);
    } else {
      return etherValue.toFixed(4);
    }
  }
  
  // For smaller numbers, use appropriate precision
  if (numPrice === 0) return '0';
  if (numPrice < 0.0001) return '< 0.0001';
  if (numPrice >= 1000) return numPrice.toFixed(0);
  if (numPrice >= 100) return numPrice.toFixed(1);
  if (numPrice >= 10) return numPrice.toFixed(2);
  
  return numPrice.toFixed(Math.min(decimalPlaces, 4));
};

// Format price with token symbol
export const formatPriceWithSymbol = (price, tokenSymbol = PARTICIPATION_CONFIG.costCalculation.defaultTokenSymbol) => {
  const formattedPrice = formatPrice(price);
  return `${formattedPrice} ${tokenSymbol}`;
};

// Calculate sales progress percentage
export const calculateSalesProgress = (ticketsSold, maxTickets) => {
  if (!maxTickets || maxTickets === 0) return 0;
  
  const sold = parseInt(ticketsSold) || 0;
  const max = parseInt(maxTickets) || 0;
  
  return Math.min(100, Math.max(0, (sold / max) * 100));
};

// Validate quantity within limits
export const validateQuantity = (quantity, maxTicketsPerWallet) => {
  const qty = parseInt(quantity) || PARTICIPATION_CONFIG.defaultQuantity;
  const min = PARTICIPATION_CONFIG.minQuantity;
  const max = maxTicketsPerWallet || PARTICIPATION_CONFIG.maxQuantityFallback;
  
  return Math.max(min, Math.min(max, qty));
};

// Get quantity change with validation
export const getUpdatedQuantity = (currentQuantity, change, maxTicketsPerWallet) => {
  const newQuantity = currentQuantity + change;
  return validateQuantity(newQuantity, maxTicketsPerWallet);
};

// Check if user can buy more tickets
export const canBuyMoreTickets = (currentQuantity, maxTicketsPerWallet) => {
  const max = maxTicketsPerWallet || PARTICIPATION_CONFIG.maxQuantityFallback;
  return currentQuantity < max;
};

// Check if user can buy fewer tickets
export const canBuyFewerTickets = (currentQuantity) => {
  return currentQuantity > PARTICIPATION_CONFIG.minQuantity;
};

// Format prize amount based on type
export const formatPrizeAmount = (raffle) => {
  if (!raffle) return '';
  
  if (raffle.prizeType === 'TOKEN') {
    const amount = raffle.prizeAmountFormatted || raffle.prizeAmount || '0';
    const symbol = raffle.ticketTokenSymbol || PARTICIPATION_CONFIG.costCalculation.defaultTokenSymbol;
    return `${amount} ${symbol}`;
  }
  
  return 'NFT Prize';
};

// Calculate platform fee amount
export const calculatePlatformFee = (totalCost, feePercentage) => {
  if (!totalCost || !feePercentage) return 0;
  
  const cost = parseFloat(totalCost) || 0;
  const fee = parseFloat(feePercentage) || 0;
  
  return (cost * fee) / 100;
};

// Calculate net amount after platform fee
export const calculateNetAmount = (totalCost, feePercentage) => {
  const platformFee = calculatePlatformFee(totalCost, feePercentage);
  return totalCost - platformFee;
}; 