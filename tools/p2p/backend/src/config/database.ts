import mongoose from 'mongoose';
import { config } from './index';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    console.log(' Already connected to MongoDB');
    return;
  }

  try {
    const connection = await mongoose.connect(config.mongodb.uri);
    
    isConnected = connection.connections[0].readyState === 1;
    
    console.log('�� Connected to MongoDB successfully');
    console.log(`  Database: ${connection.connections[0].name}`);
    
    mongoose.connection.on('error', (error) => {
      console.error(' MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log(' MongoDB disconnected');
      isConnected = false;
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log(' MongoDB connection closed');
      process.exit(0);
    });

  } catch (error) {
    console.error(' Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export function getDatabaseStatus(): boolean {
  return isConnected;
}
