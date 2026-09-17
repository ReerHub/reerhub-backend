import '../config/env.js';

import { disconnectDB } from '../config/db.js';
import mongoose from 'mongoose';
import Job from '../models/job.model.js';
import { createContentHash } from '../services/jobIdentity.service.js';
import {
  TAXONOMY_VERSION,
  classifyRole,
  extractSkills,
  isIndiaRole,
} from '../services/roleClassifier.service.js';

// Tech-only migration, single pass: every stored job is re-classified with
// the 9-track taxonomy. Tech jobs are re-tagged in place; non-tech jobs
// (and their change history) are deleted so the DB stays purely tech.
// DRY_RUN=true (default) only reports. Set DRY_RUN=false to apply.
const DRY_RUN = process.env.DRY_RUN !== 'false';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
  });
  const changes = mongoose.connection.db.collection('jobchanges');

  const distribution = {};
  let purged = 0;
  let processed = 0;

  const cursor = Job.find({}).cursor();
  for await (const job of cursor) {
    const { techTrack, techRole, seniority } = classifyRole({
      title: job.title,
      department: job.department,
    });

    if (DRY_RUN) {
      if (!techTrack) purged += 1;
      else {
        distribution[techTrack] = (distribution[techTrack] || 0) + 1;
        processed += 1;
      }
      continue;
    }

    if (!techTrack) {
      await changes.deleteMany({ jobId: job._id });
      await Job.deleteOne({ _id: job._id });
      purged += 1;
      continue;
    }

    job.techTrack = techTrack;
    job.techRole = techRole;
    if (seniority) job.seniority = seniority;
    job.taxonomyVersion = TAXONOMY_VERSION;
    job.isIndiaRole = isIndiaRole(job.locations);
    if (!job.skills || job.skills.length === 0) {
      job.skills = extractSkills(`${job.title} ${job.description || ''}`);
    }
    // Legacy field lives outside strict-mode paths: drop at driver level below.
    job.contentHash = createContentHash(job.toObject());
    await job.save();

    distribution[techTrack] = (distribution[techTrack] || 0) + 1;
    processed += 1;
  }

  console.log(
    DRY_RUN ? '[DRY RUN] ' : '',
    `Tech kept/tagged: ${processed}, non-tech purged: ${purged}.`,
    distribution
  );

  if (!DRY_RUN) {
    await mongoose.connection.db
      .collection('jobs')
      .updateMany({}, { $unset: { jobCategory: 1 } });
    await Job.syncIndexes();
    console.log('Legacy field removed; indexes aligned with schema.');
  }
  await mongoose.disconnect();
  await disconnectDB();
};

run().catch(async (error) => {
  console.error('Migration failed:', error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
