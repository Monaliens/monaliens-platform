import { PRIZE_TYPES } from '../../../utils/constants';

// Form field configurations
export const FORM_FIELDS = {
  title: {
    type: 'text',
    label: 'Title',
    placeholder: 'Enter raffle title',
    required: true,
    validation: {
      minLength: 3,
      maxLength: 100,
      required: true
    },
    errorMessages: {
      required: 'Title is required',
      minLength: 'Title must be at least 3 characters',
      maxLength: 'Title cannot exceed 100 characters'
    }
  },
  description: {
    type: 'textarea',
    label: 'Description',
    placeholder: 'Describe your raffle and what participants can win',
    required: true,
    validation: {
      minLength: 10,
      maxLength: 500,
      required: true
    },
    errorMessages: {
      required: 'Description is required',
      minLength: 'Description must be at least 10 characters',
      maxLength: 'Description cannot exceed 500 characters'
    },
    helperText: 'Minimum 10 characters'
  },
  prizeAmount: {
    type: 'number',
    label: 'Prize Amount',
    placeholder: '0.0',
    required: true,
    step: '0.001',
    min: '0.001',
    validation: {
      min: 0.001,
      required: true,
      mustNotExceedBalance: true
    },
    errorMessages: {
      required: 'Prize amount is required',
      min: 'Prize amount must be greater than 0',
      mustNotExceedBalance: 'Prize amount cannot exceed your balance'
    },
    showFor: [PRIZE_TYPES.TOKEN]
  },
  ticketPrice: {
    type: 'number',
    label: 'Ticket Price',
    placeholder: '0.0',
    required: true,
    step: '0.001',
    min: '0.001',
    validation: {
      min: 0.001,
      required: true
    },
    errorMessages: {
      required: 'Ticket price is required',
      min: 'Ticket price must be greater than 0'
    },
    helperText: 'Price per ticket in MON'
  },
  maxTotalTickets: {
    type: 'number',
    label: 'Max Total Tickets',
    placeholder: '100 (min 10)',
    required: true,
    min: '10',
    max: '10000',
    validation: {
      min: 10,
      max: 10000,
      required: true
    },
    errorMessages: {
      required: 'Max total tickets is required',
      min: 'Max total tickets must be at least 10',
      max: 'Max total tickets cannot exceed 10,000'
    },
    helperText: 'Total tickets available (min 10, max 10,000)'
  },
  maxTicketsPerWallet: {
    type: 'number',
    label: 'Max Tickets Per Person',
    placeholder: '10',
    required: true,
    min: '1',
    max: '1000',
    validation: {
      min: 1,
      max: 1000,
      required: true,
      maxPercentOfTotal: 0.4
    },
    errorMessages: {
      required: 'Max tickets per person is required',
      min: 'Max tickets per person must be at least 1',
      max: 'Max tickets per person cannot exceed 1,000',
      maxPercentOfTotal: 'Cannot exceed 40% of total tickets'
    },
    helperText: 'Maximum tickets per person'
  },
  customDuration: {
    type: 'number',
    label: 'Custom Duration',
    placeholder: 'Hours (1-8760)',
    min: '1',
    max: '8760',
    validation: {
      min: 1,
      max: 8760,
      required: true
    },
    errorMessages: {
      required: 'Custom duration is required',
      min: 'Duration must be at least 10 minutes',
      max: 'Duration cannot exceed 1 year (8760 hours)'
    },
    helperText: 'Enter duration in hours (max 1 year)'
  }
};

// Initial form data
export const INITIAL_FORM_DATA = {
  prizeType: PRIZE_TYPES.TOKEN,
  title: '',
  description: '',
  selectedAsset: null,
  prizeAmount: '',
  ticketPrice: '',
  maxTotalTickets: '',
  maxTicketsPerWallet: '',
  duration: 24, // hours
  customDuration: '',
  useCustomDuration: false
};

// Form sections configuration
export const FORM_SECTIONS = [
  {
    id: 'prizeType',
    title: 'Prize Type',
    description: 'Choose what type of prize you want to raffle',
    fields: []
  },
  {
    id: 'assetSelection',
    title: 'Asset Selection',
    description: 'Select the asset you want to raffle',
    fields: ['selectedAsset']
  },
  {
    id: 'basicInfo',
    title: 'Basic Information',
    description: 'Provide details about your raffle',
    fields: ['title', 'description']
  },
  {
    id: 'prizeConfig',
    title: 'Prize Configuration',
    description: 'Configure prize details and ticket settings',
    fields: ['prizeAmount', 'ticketPrice', 'maxTotalTickets', 'maxTicketsPerWallet']
  },
  {
    id: 'duration',
    title: 'Duration',
    description: 'Set how long your raffle will run',
    fields: ['duration', 'useCustomDuration', 'customDuration']
  }
];

// Prize type options
export const PRIZE_TYPE_OPTIONS = [
  {
    value: PRIZE_TYPES.TOKEN,
    label: 'Token',
    description: 'Raffle a specific amount of tokens',
    icon: 'T',
    color: '#6930c3'
  },
  {
    value: PRIZE_TYPES.NFT,
    label: 'NFT',
    description: 'Raffle a unique NFT from your collection',
    icon: 'N',
    color: '#9d4edd'
  }
];

// Validation rules
export const VALIDATION_RULES = {
  // Text validation
  validateText: (value, rules) => {
    if (rules.required && (!value || !value.trim())) {
      return 'This field is required';
    }
    
    const length = value ? value.trim().length : 0;
    
    if (rules.minLength && length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }
    
    if (rules.maxLength && length > rules.maxLength) {
      return `Cannot exceed ${rules.maxLength} characters`;
    }
    
    return null;
  },
  
  // Number validation
  validateNumber: (value, rules, formData = {}) => {
    if (rules.required && (!value || value === '')) {
      return 'This field is required';
    }
    
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return 'Must be a valid number';
    }
    
    if (rules.min !== undefined && numValue < rules.min) {
      return `Must be at least ${rules.min}`;
    }
    
    if (rules.max !== undefined && numValue > rules.max) {
      return `Cannot exceed ${rules.max}`;
    }
    
    // Special validation for maxTicketsPerWallet
    if (rules.maxPercentOfTotal && formData.maxTotalTickets) {
      const totalTickets = parseFloat(formData.maxTotalTickets);
      if (totalTickets > 0) {
        const maxAllowed = Math.floor(totalTickets * rules.maxPercentOfTotal);
        if (numValue > maxAllowed) {
          return `Cannot exceed ${Math.floor(rules.maxPercentOfTotal * 100)}% of total tickets (max: ${maxAllowed})`;
        }
      }
    }
    
    return null;
  },
  
  // Asset selection validation
  validateAsset: (asset, prizeType) => {
    // TOKEN türü için selectedAsset kontrolü yapmayız, çünkü native Monad token otomatik kullanılır
    if (prizeType === PRIZE_TYPES.TOKEN) {
      return null; // TOKEN türü için asset validation gerekli değil
    }
    
    // NFT türü için asset seçimi zorunlu
    if (prizeType === PRIZE_TYPES.NFT) {
      if (!asset) {
        return 'Please select an NFT to raffle';
      }
      
      if (!asset.tokenId) {
        return 'Selected NFT is missing token ID';
      }
      if (!asset.contractAddress) {
        return 'Selected NFT is missing contract address';
      }
    }
    
    return null;
  },
  
  // Balance validation for tokens
  validateBalance: (amount, asset, externalBalance = null) => {
    // TOKEN durumunda external balance kullan
    let availableBalance;
    let symbol = 'MON';
    
    if (externalBalance !== null) {
      availableBalance = parseFloat(externalBalance);
    } else if (asset && asset.balance) {
      availableBalance = parseFloat(asset.balance.replace(/,/g, ''));
      symbol = asset.symbol || 'MON';
    } else {
      return null; // Balance bilgisi yok
    }
    
    const requestedAmount = parseFloat(amount);
    
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return null; // Amount validation başka yerde yapılır
    }
    
    // Balance'ın %98'inden fazla girilemez (2% güvenlik marjı)
    const maxAllowed = availableBalance * 0.98;
    
    if (requestedAmount > maxAllowed) {
      return `Prize amount cannot exceed 98% of your balance (Max: ${maxAllowed.toFixed(6)} ${symbol})`;
    }
    
    if (requestedAmount > availableBalance) {
      return `Prize amount cannot exceed your balance (${availableBalance.toFixed(6)} ${symbol})`;
    }
    
    return null;
  }
};

// Form step configuration for wizard-like flow
export const FORM_STEPS = [
  {
    id: 'type',
    title: 'Choose Prize Type',
    sections: ['prizeType']
  },
  {
    id: 'asset',
    title: 'Select Asset',
    sections: ['assetSelection']
  },
  {
    id: 'details',
    title: 'Raffle Details',
    sections: ['basicInfo', 'prizeConfig', 'duration']
  }
]; 