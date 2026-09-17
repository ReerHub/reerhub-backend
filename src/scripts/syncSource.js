import '../config/env.js';

import connectDB, { disconnectDB } from '../config/db.js';
import { getAdapter } from '../adapters/index.js';
import JobSource from '../models/jobSource.model.js';
import { syncJobSource } from '../services/sync.service.js';

// Operator tool: run a source sync inline (same code path as the BullMQ
// worker, but without Redis). Usage:
//   node src/scripts/syncSource.js freshworks
//   node src/scripts/syncSource.js enterpret
const pattern = process.argv[2];
if (!pattern) {
  console.error('Usage: node src/scripts/syncSource.js <source-name-pattern>');
  process.exit(1);
}

const run = async () => {
  await connectDB();
  const source = await JobSource.findOne({
    name: new RegExp(pattern, 'i'),
    isActive: true,
  });
  if (!source) throw new Error(`No active source matches "${pattern}"`);

  console.log(`Syncing ${source.name} (${source.type})...`);
  const result = await syncJobSource({ source, fetchJobs: getAdapter(source.type) });
  console.log(`Status: ${result.status}`);
  console.log(JSON.stringify(result.stats, null, 2));
  if (result.errors.length > 0) console.log('Errors:', result.errors.slice(0, 5));
  if (result.warnings.length > 0) console.log('Warnings:', result.warnings.slice(0, 5));
  await disconnectDB();
};

run().catch(async (error) => {
  console.error('Sync failed:', error.message);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
