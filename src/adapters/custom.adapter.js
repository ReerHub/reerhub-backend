/**
 * Custom careers-page adapter (placeholder for MVP).
 * Razorpay / CRED / Meesho do not expose a public Greenhouse/Ashby board yet,
 * so real HTML fetching will be added after we inspect each careers page.
 * For now it fails loudly so sync_logs record a clear error instead of
 * silently marking jobs closed (closed-job safety rule).
 */
export const fetchCustomJobs = async (source) => {
  throw new Error(
    `Custom adapter not implemented yet for source "${source.name}". ` +
      `Add the site-specific fetcher before enabling daily sync.`
  );
};
