import mongoose, { Schema, Document } from 'mongoose';

export interface IFlip extends Document {
  sequenceNumber: string;
  player: string;
  choice: boolean; // true = heads, false = tails
  result?: boolean; // true = heads, false = tails
  winner?: boolean;
  amount: string; // BigInt as string
  isNative: boolean; // true = MON, false = LMON
  randomNumber?: string; // bytes32 as hex string
  completed: boolean;
  blockNumber?: number;
  transactionHash?: string;
  resultTransactionHash?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FlipSchema: Schema = new Schema(
  {
    sequenceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    player: {
      type: String,
      required: true,
      index: true,
    },
    choice: {
      type: Boolean,
      required: true,
    },
    result: {
      type: Boolean,
    },
    winner: {
      type: Boolean,
    },
    amount: {
      type: String,
      required: true,
    },
    isNative: {
      type: Boolean,
      required: true,
    },
    randomNumber: {
      type: String,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockNumber: {
      type: Number,
    },
    transactionHash: {
      type: String,
      index: true,
    },
    resultTransactionHash: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
FlipSchema.index({ player: 1, timestamp: -1 });
FlipSchema.index({ completed: 1, timestamp: -1 });

export default mongoose.models.Flip || mongoose.model<IFlip>('Flip', FlipSchema);





















