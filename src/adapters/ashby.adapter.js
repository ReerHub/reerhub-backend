/**
 * Ashby adapter.
 * Docs: https://developers.ashbyhq.com/docs/job-board-api
 * Config: { boardName: "cred" }
 * Why: deterministic JSON API. Stable IDs -> externalJobId.
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

export const fetchAshbyJobs = async (source) => {
  const boardName = source.config?.boardName;
  if (!boardName) {
    throw new Error(`Ashby source "${source.name}" is missing config.boardName`);
  }

  const url = `https://api.ashbyhq.com/posting-api/job-board/${boardName}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Ashby fetch failed (${response.status}) for ${boardName}`);
  }

  const data = await response.json();
  return (data.jobs || []).map((job) => ({
    externalJobId: String(job.id),
    title: job.title,
    rawTitle: job.title,
    description: job.descriptionHtml || job.description || '',
    locations: job.locationName || job.location?.name || '',
    remoteType: job.isRemote ? 'remote' : undefined,
    employmentType: job.employmentType || undefined,
    department: job.departmentName || undefined,
    applicationUrl: job.jobUrl,
    sourceUrl: job.jobUrl,
    postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
    raw: job,
  }));
};
