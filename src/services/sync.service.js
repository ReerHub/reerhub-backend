import mongoose from 'mongoose';

import Job from '../models/job.model.js';
import JobChange from '../models/jobChange.model.js';
import JobSource from '../models/jobSource.model.js';
import SyncLog from '../models/syncLog.model.js';
import { createContentHash, createJobFingerprint } from './jobIdentity.service.js';
import { normalizeRawJob } from './jobNormalizer.service.js';
import {
  classifyRole,
  extractSkills,
  isIndiaRole,
  TAXONOMY_VERSION,
} from './roleClassifier.service.js';

const trackedFields = [
  'title',
  'normalizedTitle',
  'description',
  'locations',
  'remoteType',
  'employmentType',
  'department',
  'experience',
  'salary',
  'skills',
  'techTrack',
  'techRole',
  'taxonomyVersion',
  'seniority',
  'applicationUrl',
  'sourceUrl',
  'postedAt',
];

const valueForComparison = (value) => {
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value ?? null);
};

const detectChanges = (previous, next) => {
  const changes = {};

  for (const field of trackedFields) {
    if (valueForComparison(previous[field]) !== valueForComparison(next[field])) {
      changes[field] = { old: previous[field], new: next[field] };
    }
  }

  return changes;
};

const createStats = () => ({
  fetched: 0,
  parsed: 0,
  newJobs: 0,
  updatedJobs: 0,
  unchangedJobs: 0,
  closedJobs: 0,
  duplicates: 0,
  nonTechSkipped: 0,
  nonIndiaFiltered: 0,
});

/**
 * Runs a complete source sync. The adapter fetcher must return an array of raw jobs.
 * Missing-job closure only runs when every fetched job was processed without errors.
 */
export const syncJobSource = async ({ source, fetchJobs }) => {
  const runStartedAt = new Date();
  const stats = createStats();
  const errors = [];
  const warnings = [];

  const syncLog = await SyncLog.create({
    sourceId: source._id,
    companyId: source.companyId,
    startedAt: runStartedAt,
    status: 'running',
    stats,
  });

  await JobSource.findByIdAndUpdate(source._id, { lastAttemptedSyncAt: runStartedAt });

  try {
    const rawJobs = await fetchJobs(source);
    if (!Array.isArray(rawJobs))
      throw new Error('Source adapter must return an array of jobs');

    stats.fetched = rawJobs.length;
    const seenIdentities = new Set();

    // Phase 1: normalize + classify (CPU only). Per-job error isolation
    // is preserved: one bad posting never poisons the batch.
    const prepared = [];
    let errorOverflow = 0;
    const pushJobError = (message) => {
      if (errors.length < 50) errors.push(message);
      else errorOverflow += 1;
    };

    for (const rawJob of rawJobs) {
      try {
        const job = normalizeRawJob(rawJob);
        job.companyId = source.companyId;
        job.sourceId = source._id;
        // Pure tech platform: non-tech titles are dropped here, before
        // fingerprinting or storage. A tech job edited into non-tech
        // closes naturally next run (its lastSeenAt goes stale).
        const { techTrack, techRole, seniority } = classifyRole({
          title: job.title,
          department: job.department,
        });
        if (!techTrack) {
          stats.nonTechSkipped += 1;
          continue;
        }
        job.techTrack = techTrack;
        job.techRole = techRole;
        if (seniority) job.seniority = seniority;
        job.taxonomyVersion = TAXONOMY_VERSION;
        job.isIndiaRole = isIndiaRole(job.locations);
        if (job.skills.length === 0) {
          job.skills = extractSkills(`${job.title} ${job.description}`);
        }
        if (!job.isIndiaRole) stats.nonIndiaFiltered += 1;
        job.jobFingerprint = createJobFingerprint(job);
        job.contentHash = createContentHash(job);

        const identity = job.externalJobId
          ? `external:${job.externalJobId}`
          : `fingerprint:${job.jobFingerprint}`;
        if (seenIdentities.has(identity)) {
          stats.duplicates += 1;
          continue;
        }
        seenIdentities.add(identity);
        prepared.push(job);
      } catch (error) {
        pushJobError(error.message);
      }
    }
    stats.parsed = prepared.length;
    if (errorOverflow > 0) {
      warnings.push(`${errorOverflow} further job errors truncated from this log.`);
    }

    // Phase 2: batch lookup existing jobs to decide insert vs update.
    // Single indexed query replaces N sequential findOne calls.
    const jobOps = [];
    const changeDocs = [];
    const pendingStats = { newJobs: 0, updatedJobs: 0, unchangedJobs: 0 };

    const externalIds = prepared
      .filter((j) => j.externalJobId)
      .map((j) => j.externalJobId);
    const fingerprints = prepared
      .filter((j) => !j.externalJobId)
      .map((j) => j.jobFingerprint);

    const orFilters = [];
    if (externalIds.length > 0) orFilters.push({ externalJobId: { $in: externalIds } });
    if (fingerprints.length > 0)
      orFilters.push({ jobFingerprint: { $in: fingerprints } });

    const existingJobs =
      orFilters.length > 0
        ? await Job.find({ sourceId: source._id, $or: orFilters })
            // Lean docs = plain objects. Detect changes by preloading the
            // tracked fields (omitting identity fields would make every
            // existing job look "changed" and spam JobChange documents).
            .select(
              [
                '_id',
                'externalJobId',
                'jobFingerprint',
                'contentHash',
                'status',
                ...trackedFields,
              ].join(' ')
            )
            .lean()
        : [];

    // Build lookup maps keyed by externalJobId and fingerprint.
    const byExternalId = new Map();
    const byFingerprint = new Map();
    for (const j of existingJobs) {
      if (j.externalJobId) byExternalId.set(j.externalJobId, j);
      if (j.jobFingerprint) byFingerprint.set(j.jobFingerprint, j);
    }

    for (const job of prepared) {
      const existing = job.externalJobId
        ? byExternalId.get(job.externalJobId)
        : byFingerprint.get(job.jobFingerprint);
      const lastSeenAt = new Date();

      if (!existing) {
        const jobId = new mongoose.Types.ObjectId();
        jobOps.push({
          insertOne: {
            document: {
              ...job,
              _id: jobId,
              firstSeenAt: lastSeenAt,
              lastSeenAt,
              status: 'active',
            },
          },
        });
        changeDocs.push({ jobId, type: 'created', detectedAt: lastSeenAt });
        pendingStats.newJobs += 1;
        continue;
      }

      const statusChanged = existing.status !== 'active';
      const contentChanged = existing.contentHash !== job.contentHash;
      const changes = contentChanged ? detectChanges(existing, job) : {};

      jobOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: { ...job, lastSeenAt, status: 'active' } },
        },
      });

      if (statusChanged) {
        changeDocs.push({
          jobId: existing._id,
          type: 'reopened',
          detectedAt: lastSeenAt,
        });
        pendingStats.updatedJobs += 1;
      } else if (contentChanged) {
        changeDocs.push({
          jobId: existing._id,
          type: 'updated',
          changes,
          detectedAt: lastSeenAt,
        });
        pendingStats.updatedJobs += 1;
      } else {
        pendingStats.unchangedJobs += 1;
      }
    }

    // Phase 3: batched writes. One bulkWrite + one insertMany replaces
    // 2-3 round-trips per job. On failure the run is partial (closures
    // stay skipped via errors.length > 0) and the next sync converges.
    if (jobOps.length > 0) {
      try {
        await Job.bulkWrite(jobOps, { ordered: false });
        if (changeDocs.length > 0) {
          await JobChange.insertMany(changeDocs, { ordered: false });
        }
        stats.newJobs += pendingStats.newJobs;
        stats.updatedJobs += pendingStats.updatedJobs;
        stats.unchangedJobs += pendingStats.unchangedJobs;
      } catch (error) {
        pushJobError(`Bulk write failed: ${String(error.message).slice(0, 300)}`);
      }
    }

    // Parsing errors or an unexpected empty result cannot safely establish that unseen jobs are closed.
    const canDetectClosures =
      errors.length === 0 &&
      (rawJobs.length > 0 || source.config?.allowEmptyResult === true);
    if (canDetectClosures) {
      const missingJobs = await Job.find({
        sourceId: source._id,
        status: 'active',
        lastSeenAt: { $lt: runStartedAt },
      }).select('_id');

      if (missingJobs.length > 0) {
        const detectedAt = new Date();
        await Job.updateMany(
          { _id: { $in: missingJobs.map((job) => job._id) } },
          { status: 'closed', lastSeenAt: detectedAt }
        );
        await JobChange.insertMany(
          missingJobs.map((job) => ({ jobId: job._id, type: 'closed', detectedAt }))
        );
        stats.closedJobs = missingJobs.length;
      }
    } else if (errors.length > 0) {
      warnings.push(
        'Closed-job detection skipped because one or more jobs could not be processed.'
      );
    } else {
      warnings.push('Closed-job detection skipped because the source returned no jobs.');
    }

    const status = errors.length === 0 ? 'success' : 'partial';
    const completedAt = new Date();

    await Promise.all([
      SyncLog.findByIdAndUpdate(syncLog._id, {
        status,
        stats,
        errors,
        warnings,
        completedAt,
      }),
      JobSource.findByIdAndUpdate(source._id, {
        ...(status === 'success' ? { lastSuccessfulSyncAt: completedAt } : {}),
      }),
    ]);

    return { status, stats, errors, warnings, syncLogId: syncLog._id };
  } catch (error) {
    const completedAt = new Date();
    await SyncLog.findByIdAndUpdate(syncLog._id, {
      status: 'failed',
      stats,
      errors: [error.message],
      warnings,
      completedAt,
    });
    throw error;
  }
};
