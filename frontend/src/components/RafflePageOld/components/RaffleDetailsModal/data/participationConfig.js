// Participation form configuration
export const PARTICIPATION_CONFIG = {
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantityFallback: 10,
  
  // Button texts
  buttonTexts: {
    participate: (quantity) => `Buy ${quantity} Ticket${quantity > 1 ? 's' : ''}`,
    processing: 'Processing Transaction...',
    ended: 'Raffle Ended',
    notAuthenticated: 'Connect Wallet to Buy Tickets',
    insufficientBalance: 'Insufficient Balance',
    maxTicketsReached: 'Max Tickets Reached'
  },
  
  // Form validation
  validation: {
    minQuantity: 1,
    maxQuantity: (maxTicketsPerWallet) => maxTicketsPerWallet || 10,
    quantityStep: 1,
    messages: {
      minQuantity: (min) => `Minimum ${min} ticket required`,
      maxQuantity: (max) => `Maximum ${max} tickets per wallet`,
      insufficientBalance: 'Insufficient balance for this purchase',
      invalidQuantity: 'Please enter a valid quantity'
    }
  },
  
  // Cost calculation
  costCalculation: {
    decimalPlaces: 4,
    defaultTokenSymbol: 'MON',
    platformFeeLabel: 'Platform Fee',
    totalLabel: 'Total Cost'
  },
  
  // Error handling
  errorHandling: {
    messages: {
      REJECTED: 'Transaction rejected by user',
      INSUFFICIENT_FUNDS: 'Insufficient funds for transaction',
      NETWORK_ERROR: 'Network error - please try again',
      RAFFLE_ENDED: 'Raffle has ended',
      RAFFLE_INACTIVE: 'Raffle is not active',
      MAX_TICKETS_EXCEEDED: 'Exceeds maximum tickets per wallet',
      MAX_TOTAL_EXCEEDED: 'Exceeds maximum total tickets for raffle',
      INVALID_RAFFLE: 'Invalid raffle data',
      TIMEOUT: 'Request timeout - please try again',
      UNKNOWN: 'An unexpected error occurred'
    }
  }
};

// Information sections configuration
export const INFO_SECTIONS = [
  {
    id: 'nftMetadata',
    title: 'NFT Details',
    condition: (raffle) => raffle.prizeType === 'NFT' && raffle.prizeMetadata,
    fields: [
      {
        key: 'name',
        label: 'Name',
        getValue: (raffle) => raffle.prizeMetadata?.name
      },
      {
        key: 'description', 
        label: 'Description',
        getValue: (raffle) => raffle.prizeMetadata?.description
      },
      {
        key: 'creator',
        label: 'Creator',
        getValue: (raffle) => raffle.prizeMetadata?.creator
      },
      {
        key: 'collection',
        label: 'Collection',
        getValue: (raffle) => raffle.prizeMetadata?.collection
      },
      {
        key: 'edition',
        label: 'Edition', 
        getValue: (raffle) => raffle.prizeMetadata?.edition
      },
      {
        key: 'animation',
        label: 'Animation',
        getValue: (raffle) => raffle.prizeMetadata?.animation_url,
        type: 'link',
        linkText: 'View Animation →'
      }
    ]
  },
  {
    id: 'prizeInfo',
    title: 'Prize Information',
    condition: () => true,
    fields: [
      {
        key: 'prizeAmount',
        label: 'Prize Amount',
        getValue: (raffle) => raffle.prizeType === 'TOKEN' 
          ? `${raffle.prizeAmountFormatted || raffle.prizeAmount} ${raffle.ticketTokenSymbol || 'MON'}`
          : 'NFT Prize'
      },
      {
        key: 'ticketPrice',
        label: 'Ticket Price',
        getValue: (raffle) => `${raffle.ticketPriceFormatted || raffle.ticketPrice || 0} ${raffle.ticketTokenSymbol || 'MON'}`
      },
      {
        key: 'maxPerWallet',
        label: 'Max Per Wallet',
        getValue: (raffle) => raffle.maxTicketsPerWallet || 'Unlimited'
      }
    ]
  },
  {
    id: 'statistics',
    title: 'Raffle Statistics',
    condition: () => true,
    fields: [
      {
        key: 'ticketsSold',
        label: 'Tickets Sold',
        getValue: (raffle) => raffle.totalTicketsSold || 0
      },
      {
        key: 'participants',
        label: 'Participants',
        getValue: (raffle) => raffle.totalParticipants || 0
      },
      {
        key: 'platformFee',
        label: 'Platform Fee',
        getValue: (raffle) => `${raffle.platformFeePercentage || 5}%`
      }
    ]
  }
];

// Platform fee calculation helper - handles both percentage and basis points
const calculatePlatformFee = (totalCost, platformFeePercentage) => {
  if (!totalCost || !platformFeePercentage) return 0;
  
  // If the percentage is greater than 100, it's likely in basis points
  const divisor = platformFeePercentage > 100 ? 10000 : 100;
  return (totalCost * platformFeePercentage) / divisor;
};

// Cost summary configuration with platform fee breakdown
export const COST_SUMMARY_CONFIG = {
  rows: [
    {
      id: 'ticketPrice',
      label: 'Ticket Price:',
      getValue: (raffle) => {
        const price = parseFloat(raffle.ticketPriceFormatted || raffle.ticketPrice || 0);
        
        let formattedPrice;
        if (price >= 1000) {
          formattedPrice = price.toFixed(0);
        } else if (price >= 100) {
          formattedPrice = price.toFixed(1);
        } else if (price >= 10) {
          formattedPrice = price.toFixed(2);
        } else if (price > 0) {
          formattedPrice = price.toFixed(4);
        } else {
          formattedPrice = '0';
        }
        
        return `${formattedPrice} ${raffle.ticketTokenSymbol || 'MON'}`;
      }
    },
    {
      id: 'quantity',
      label: 'Quantity:',
      getValue: (raffle, quantity) => quantity
    },
    {
      id: 'subtotal',
      label: 'Subtotal:',
      getValue: (raffle, quantity, totalCost) => {
        // For simple calculation: base ticket price * quantity
        const ticketPrice = parseFloat(raffle.ticketPriceFormatted || raffle.ticketPrice || 0);
        const subtotal = ticketPrice * quantity;
        
        let formattedCost;
        if (subtotal >= 1000) {
          formattedCost = subtotal.toFixed(0);
        } else if (subtotal >= 100) {
          formattedCost = subtotal.toFixed(1);
        } else if (subtotal >= 10) {
          formattedCost = subtotal.toFixed(2);
        } else if (subtotal > 0) {
          formattedCost = subtotal.toFixed(4);
        } else {
          formattedCost = '0';
        }
        
        return `${formattedCost} ${raffle.ticketTokenSymbol || 'MON'}`;
      }
    },
    {
      id: 'platformFee',
      label: 'Platform Fee:',
      getValue: (raffle, quantity, totalCost) => {
        const platformFeePercentage = raffle.platformFeePercentage || 0;
        const ticketPrice = parseFloat(raffle.ticketPriceFormatted || raffle.ticketPrice || 0);
        const subtotal = ticketPrice * quantity;
        
        // Calculate platform fee from subtotal
        const divisor = platformFeePercentage > 100 ? 10000 : 100;
        const platformFee = (subtotal * platformFeePercentage) / divisor;
        
        // Display percentage correctly - fix 1000% display issue
        const displayPercentage = platformFeePercentage > 100 
          ? (platformFeePercentage / 100).toFixed(1) 
          : platformFeePercentage.toFixed(1);
        console.log('Platform Fee Calculation:', displayPercentage)
        let formattedFee;
        if (platformFee >= 1000) {
          formattedFee = platformFee.toFixed(0);
        } else if (platformFee >= 100) {
          formattedFee = platformFee.toFixed(1);
        } else if (platformFee >= 10) {
          formattedFee = platformFee.toFixed(2);
        } else if (platformFee > 0) {
          formattedFee = platformFee.toFixed(4);
        } else {
          formattedFee = '0';
        }
        
        return `${formattedFee} ${raffle.ticketTokenSymbol || 'MON'} (${displayPercentage}%)`;
      },
      isPlatformFee: true
    },
    {
      id: 'total',
      label: 'Total Cost:',
      getValue: (raffle, quantity, totalCost) => {
        const ticketPrice = parseFloat(raffle.ticketPriceFormatted || raffle.ticketPrice || 0);
        const subtotal = ticketPrice * quantity;
        const platformFeePercentage = raffle.platformFeePercentage || 0;
        const divisor = platformFeePercentage > 100 ? 10000 : 100;
        const platformFee = (subtotal * platformFeePercentage) / divisor;
        const actualTotal = subtotal + platformFee;
        
        let formattedCost;
        if (actualTotal >= 1000) {
          formattedCost = actualTotal.toFixed(0);
        } else if (actualTotal >= 100) {
          formattedCost = actualTotal.toFixed(1);
        } else if (actualTotal >= 10) {
          formattedCost = actualTotal.toFixed(2);
        } else if (actualTotal > 0) {
          formattedCost = actualTotal.toFixed(4);
        } else {
          formattedCost = '0';
        }
        
        return `${formattedCost} ${raffle.ticketTokenSymbol || 'MON'}`;
      },
      isTotal: true
    }
  ]
};

// Time display configuration
export const TIME_DISPLAY_CONFIG = {
  units: [
    { key: 'days', label: 'Days' },
    { key: 'hours', label: 'Hours' },
    { key: 'minutes', label: 'Minutes' }
  ],
  showWhenActive: true,
  title: 'Time Remaining'
};

// Winner information configuration
export const WINNER_CONFIG = {
  title: 'Raffle Ended',
  endedMessage: 'This raffle has concluded',
  winnerLabel: 'Winner:',
  drawnLabel: 'Winner drawn on:',
  addressFormat: {
    startChars: 6,
    endChars: 4
  },
  dateFormat: {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
}; 