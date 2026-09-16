import Job from '../models/job.model.js';
import JobChange from '../models/jobChange.model.js';
import JobSource from '../models/jobSource.model.js';
import SyncLog from '../models/syncLog.model.js';
import { createContentHash, createJobFingerprint } from './jobIdentity.service.js';
import { normalizeRawJob } from './jobNormalizer.service.js';

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
  'jobCategory',
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

    for (const rawJob of rawJobs) {
      try {
        const job = normalizeRawJob(rawJob);
        job.companyId = source.companyId;
        job.sourceId = source._id;
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

        stats.parsed += 1;
        const lookup = job.externalJobId
          ? { sourceId: source._id, externalJobId: job.externalJobId }
          : { sourceId: source._id, jobFingerprint: job.jobFingerprint };
        const existing = await Job.findOne(lookup);
        const lastSeenAt = new Date();

        if (!existing) {
          const created = await Job.create({
            ...job,
            firstSeenAt: lastSeenAt,
            lastSeenAt,
            status: 'active',
          });
          await JobChange.create({
            jobId: created._id,
            type: 'created',
            detectedAt: lastSeenAt,
          });
          stats.newJobs += 1;
          continue;
        }

        const statusChanged = existing.status !== 'active';
        const contentChanged = existing.contentHash !== job.contentHash;
        const changes = contentChanged ? detectChanges(existing.toObject(), job) : {};

        Object.assign(existing, job, { lastSeenAt, status: 'active' });
        await existing.save();

        if (statusChanged) {
          await JobChange.create({
            jobId: existing._id,
            type: 'reopened',
            detectedAt: lastSeenAt,
          });
          stats.updatedJobs += 1;
        } else if (contentChanged) {
          await JobChange.create({
            jobId: existing._id,
            type: 'updated',
            changes,
            detectedAt: lastSeenAt,
          });
          stats.updatedJobs += 1;
        } else {
          stats.unchangedJobs += 1;
        }
      } catch (error) {
        errors.push(error.message);
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
