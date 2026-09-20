import '../config/env.js';

import { disconnectDB } from '../config/db.js';
import mongoose from 'mongoose';
import he from 'he';
import Job from '../models/job.model.js';
import { createContentHash } from '../services/jobIdentity.service.js';
import { isIndiaRole } from '../services/roleClassifier.service.js';

// Geo repair, single pass: Greenhouse-era jobs stored pre-escaped HTML
// (`&lt;div…`) get decoded, and locations stuck with the normalizer's
// `country: India` default on known-foreign cities get repaired so
// `isIndiaRole` re-tags correctly. Dev only — never run on prod.
// DRY_RUN=true (default) only reports. Set DRY_RUN=false to apply.
const DRY_RUN = process.env.DRY_RUN !== 'false';

// City (lowercased) -> correct country for rows the normalizer defaulted
// to India when the ATS sent a city-only foreign location.
const FOREIGN_CITY_TO_COUNTRY = {
  malaysia: 'Malaysia',
  'kuala lumpur': 'Malaysia',
};

// Narrow on purpose: only `&lt;` signals a pre-escaped HTML blob (the
// Greenhouse artifact). Broader entity matching would also catch legitimate
// `&amp;` in Lever/SmartRecruiters HTML and cause hash churn against the
// next sync, which stores those adapters' descriptions verbatim.
const needsDecode = (description) =>
  typeof description === 'string' && description.includes('&lt;');

const repairLocations = (locations) => {
  let fixed = false;
  const repaired = (locations || []).map((location) => {
    const city = String(location?.city || '').toLowerCase();
    const mapped = FOREIGN_CITY_TO_COUNTRY[city];
    if (mapped && location?.country === 'India') {
      fixed = true;
      return {
        ...location.toObject?.(),
        city: location.city,
        state: location.state,
        country: mapped,
      };
    }
    return location;
  });
  return { repaired, fixed };
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
  });

  let scanned = 0;
  let decoded = 0;
  let geoFixed = 0;
  let retagged = 0;

  const cursor = Job.find({}).cursor();
  for await (const job of cursor) {
    scanned += 1;
    const decodedDescription = needsDecode(job.description)
      ? he.decode(job.description)
      : job.description;
    const didDecode = decodedDescription !== job.description;

    const { repaired, fixed } = repairLocations(job.locations);
    const indiaRole = isIndiaRole(fixed ? repaired : job.locations);
    const didRetag = indiaRole !== job.isIndiaRole;

    if (DRY_RUN) {
      if (didDecode) decoded += 1;
      if (fixed) geoFixed += 1;
      if (didRetag) retagged += 1;
      continue;
    }

    if (!didDecode && !fixed && !didRetag) continue;

    if (didDecode) job.description = decodedDescription;
    if (fixed) job.locations = repaired;
    if (didRetag) job.isIndiaRole = indiaRole;
    job.contentHash = createContentHash(job.toObject());
    await job.save();

    if (didDecode) decoded += 1;
    if (fixed) geoFixed += 1;
    if (didRetag) retagged += 1;
  }

  console.log(
    DRY_RUN ? '[DRY RUN] ' : '',
    `Scanned: ${scanned}, decoded: ${decoded}, geo-fixed: ${geoFixed}, re-tagged: ${retagged}.`
  );

  await mongoose.disconnect();
  await disconnectDB();
};

run().catch(async (error) => {
  console.error('Geo backfill failed:', error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
