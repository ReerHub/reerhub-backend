import crypto from 'crypto';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const cleanText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const serializeLocations = (locations = []) =>
  locations
    .map((location) =>
      [location.city, location.state, location.country].map(cleanText).join('|')
    )
    .sort()
    .join('||');

export const createJobFingerprint = ({ companyId, title, locations, applicationUrl }) =>
  hash(
    [
      String(companyId),
      cleanText(title),
      serializeLocations(locations),
      cleanText(applicationUrl),
    ].join('::')
  );

export const createContentHash = (job) =>
  hash(
    JSON.stringify({
      title: cleanText(job.title),
      normalizedTitle: cleanText(job.normalizedTitle),
      description: cleanText(job.description),
      locations: serializeLocations(job.locations),
      remoteType: cleanText(job.remoteType),
      employmentType: cleanText(job.employmentType),
      department: cleanText(job.department),
      experience: job.experience || {},
      salary: job.salary || {},
      skills: (job.skills || []).map(cleanText).sort(),
      techTrack: cleanText(job.techTrack),
      techRole: cleanText(job.techRole),
      isIndiaRole: job.isIndiaRole !== false,
      seniority: cleanText(job.seniority),
      applicationUrl: cleanText(job.applicationUrl),
    })
  );
