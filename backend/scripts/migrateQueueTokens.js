import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { QueueEntry } from '../src/models/QueueEntry.js';
import { QueueCounter } from '../src/models/QueueCounter.js';
import '../src/models/Centre.js';
import '../src/models/User.js';
import mongoose from 'mongoose';

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const queueEntryCollection = db.collection('queueentries');
  const queueCounterCollection = db.collection('queuecounters');

  // Check existing indexes on queueentries
  const existingIndexes = await queueEntryCollection.indexes();
  console.log('Existing queueentries indexes:', existingIndexes.map(i => i.name));

  for (const idx of existingIndexes) {
    if (idx.name === 'centreId_1_slotId_1_queueDate_1_queueNumber_1') {
      console.log('Dropping old index:', idx.name);
      await queueEntryCollection.dropIndex(idx.name);
    }
  }

  // Check existing indexes on queuecounters
  const counterIndexes = await queueCounterCollection.indexes();
  console.log('Existing queuecounters indexes:', counterIndexes.map(i => i.name));

  for (const idx of counterIndexes) {
    if (idx.name === 'centreId_1_slotId_1_queueDate_1') {
      console.log('Dropping old counter index:', idx.name);
      await queueCounterCollection.dropIndex(idx.name);
    }
  }

  // Fetch all existing queue entries
  const allEntries = await QueueEntry.find({}).sort({ checkedInAt: 1, createdAt: 1 });
  console.log(`Found ${allEntries.length} total queue entries`);

  // Group by centreId and normalized queueDate
  const groups = new Map();
  for (const entry of allEntries) {
    const qDate = new Date(entry.queueDate);
    qDate.setUTCHours(0, 0, 0, 0);
    const key = `${entry.centreId.toString()}_${qDate.toISOString()}`;
    if (!groups.has(key)) {
      groups.set(key, { centreId: entry.centreId, queueDate: qDate, entries: [] });
    }
    groups.get(key).entries.push(entry);
  }

  // Clear old slot-level queuecounters
  await QueueCounter.deleteMany({});

  for (const [key, group] of groups.entries()) {
    console.log(`\nProcessing group: Centre ${group.centreId} on Date ${group.queueDate.toISOString().slice(0, 10)} with ${group.entries.length} entries`);
    let seq = 1;
    for (const entry of group.entries) {
      const newToken = `Q${String(seq).padStart(3, '0')}`;
      console.log(`  Entry ${entry._id} (${entry.queueNumber} -> ${newToken}) farmerId: ${entry.farmerId}`);
      entry.queueNumber = newToken;
      entry.queueDate = group.queueDate;
      await entry.save();
      seq++;
    }

    const finalSequence = seq - 1;
    // Remove all old slot-level counters for this centre & date
    await QueueCounter.deleteMany({
      centreId: group.centreId,
      $or: [
        { queueDate: group.queueDate },
        { queueDate: new Date(group.queueDate.getTime() + 5.5 * 3600 * 1000) }
      ]
    });
    // Create the single consolidated counter with the current sequence
    await QueueCounter.create({
      centreId: group.centreId,
      queueDate: group.queueDate,
      sequence: finalSequence
    });
    console.log(`  Set QueueCounter for centre ${group.centreId} on ${group.queueDate.toISOString().slice(0, 10)} to sequence: ${finalSequence}`);
  }

  // Ensure new indexes
  await QueueEntry.syncIndexes();
  await QueueCounter.syncIndexes();
  console.log('\nIndexes synchronized successfully.');

  const updatedEntries = await QueueEntry.find({}).populate('farmerId centreId');
  console.log('\nUpdated Queue Entries:');
  for (const e of updatedEntries) {
    console.log(`- Token: ${e.queueNumber} | Farmer: ${e.farmerId?.name || e.farmerId} | Centre: ${e.centreId?.name || e.centreId} | Status: ${e.status} | CheckedInAt: ${e.checkedInAt}`);
  }

  await disconnectDatabase();
  console.log('Finished migration.');
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
