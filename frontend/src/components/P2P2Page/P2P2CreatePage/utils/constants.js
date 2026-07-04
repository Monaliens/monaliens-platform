// P2P2-local constants and minimal ABIs to keep this page independent

export const P2P2_CONTRACT_ADDRESSES = {
  FACTORY: '0x504059D8A274E6A4dE68eeAb9d6D3288EeB55657',
  OFFER_TEMPLATE: '0x9860C5893ffc10EB3E067Ca970037a3C1DB45f45',
  LMON: '0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D'
};

export const ASSET_TYPES = {
  NATIVE: 0,
  ERC20: 1,
  ERC721: 2,
  ERC1155: 3
};

export const OFFER_TYPES = {
  SINGLE: 0,
  MULTI: 1,
  COLLECTION: 2,
  OPEN: 3
};

export const P2P2_ABIS = {
  FACTORY: [
    {
      name: 'createOfferAndDeposit',
      type: 'function',
      stateMutability: 'payable',
      inputs: [
        { name: '_offerType', type: 'uint8' },
        { name: '_targetUser', type: 'address' },
        { name: '_collectionAddress', type: 'address' },
        { name: '_duration', type: 'uint256' },
        { name: '_targetOfferId', type: 'uint256' },
        { name: '_title', type: 'string' },
        { name: '_description', type: 'string' },
        {
          name: '_offeredAssets',
          type: 'tuple[]',
          components: [
            { name: 'assetType', type: 'uint8' },
            { name: 'contractAddress', type: 'address' },
            { name: 'tokenIdOrAmount', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
            { name: 'isSpecific', type: 'bool' }
          ]
        },
        {
          name: '_requestedAssets',
          type: 'tuple[]',
          components: [
            { name: 'assetType', type: 'uint8' },
            { name: 'contractAddress', type: 'address' },
            { name: 'tokenIdOrAmount', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
            { name: 'isSpecific', type: 'bool' }
          ]
        }
      ],
      outputs: [{ name: 'offerContract', type: 'address' }]
    }
  ],
  ERC721: [
    {
      name: 'ownerOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [{ name: '', type: 'address' }]
    },
    {
      name: 'getApproved',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [{ name: '', type: 'address' }]
    },
    {
      name: 'isApprovedForAll',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'operator', type: 'address' }
      ],
      outputs: [{ name: '', type: 'bool' }]
    },
    {
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' }
      ]
    },
    {
      name: 'setApprovalForAll',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'operator', type: 'address' },
        { name: 'approved', type: 'bool' }
      ]
    }
  ],
  ERC20: [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }]
    },
    {
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' }
      ],
      outputs: [{ name: '', type: 'uint256' }]
    },
    {
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }]
    }
  ],
  OFFER_CONTRACT: [
    {
      name: 'acceptTargetedOffer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: '_targetedOfferContract', type: 'address' }]
    },
    {
      name: 'cancelOffer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: []
    }
  ]
};
