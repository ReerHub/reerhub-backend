/**
 * Lever adapter.
 * Docs: https://github.com/Lever/postings-api (no auth, JSON)
 * Config: { leverOrg: "cred" } -> https://api.lever.co/v0/postings/cred?mode=json
 * Why: deterministic JSON API. Stable IDs -> externalJobId.
 * Used by CRED + Meesho (verified: 11 + 49 jobs).
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

export const fetchLeverJobs = async (source) => {
  const leverOrg = source.config?.leverOrg;
  if (!leverOrg) {
    throw new Error(`Lever source "${source.name}" is missing config.leverOrg`);
  }

  const url = `https://api.lever.co/v0/postings/${leverOrg}?mode=json`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Lever fetch failed (${response.status}) for ${leverOrg}`);
  }

  const postings = await response.json();
  return (Array.isArray(postings) ? postings : []).map((job) => {
    const location = job.categories?.location || '';
    return {
      externalJobId: String(job.id),
      title: job.text,
      rawTitle: job.text,
      description: job.description || '',
      locations: location,
      employmentType: job.categories?.commitment || undefined,
      department: job.categories?.department || job.categories?.team || undefined,
      applicationUrl: job.hostedUrl,
      sourceUrl: job.hostedUrl,
      postedAt: job.createdAt ? new Date(job.createdAt) : undefined,
      raw: job,
    };
  });
};
