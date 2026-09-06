import mongoose from 'mongoose';
import { env } from './env.js';
import { User } from '../models/User.js';

export async function connectDatabase() {
  if (!env.mongoUri) {
    if (env.nodeEnv === 'test') return;
    throw new Error('MONGODB_URI is required. Configure backend/.env before starting the server.');
  }
  await mongoose.connect(env.mongoUri, { dbName: env.mongoDbName });
  await User.updateMany({ role: 'farmer', status: 'pending_verification' }, { $set: { status: 'active' } });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
