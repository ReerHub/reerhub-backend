/* Operator tool: end-to-end health check for the public read API.
 * Run before every demo:
 *   node src/scripts/smoke.js
 * Optional: SMOKE_API_BASE=http://localhost:8000/api/v1 (default).
 * Exits non-zero if any endpoint fails or returns an unexpected shape.
 */
const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:8000/api/v1';

const check = async (name, url, expect) => {
  let res;
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(`✗ ${name} — network error: ${err.message}`);
    return false;
  }
  if (!res.ok) {
    console.error(`✗ ${name} — HTTP ${res.status}`);
    return false;
  }
  let json;
  try {
    json = await res.json();
  } catch {
    console.error(`✗ ${name} — invalid JSON`);
    return false;
  }
  const body = await expect(json);
  if (!body) {
    console.error(`✗ ${name} — unexpected shape`);
    return false;
  }
  console.log(`✓ ${name} — ${body}`);
  return true;
};

const run = async () => {
  const results = [];
  let jobId = null;
  let companySlug = null;

  results.push(
    await check('GET /jobs', `${API_BASE}/jobs?limit=5`, (json) => {
      const total = json.pagination?.total;
      if (typeof total !== 'number') return null;
      jobId = json.data?.[0]?._id || null;
      return `${total} active jobs (India)`;
    })
  );

  results.push(
    await check(
      'GET /jobs?indiaOnly=false',
      `${API_BASE}/jobs?limit=5&indiaOnly=false`,
      (json) => {
        const total = json.pagination?.total;
        return typeof total === 'number' ? `${total} jobs incl. non-India` : null;
      }
    )
  );

  results.push(
    await check(
      'GET /jobs/:id (anon teaser)',
      `${API_BASE}/jobs/${jobId ?? '000000000000000000000000'}`,
      (json) => {
        const title = json.data?.title;
        if (!title) return null;
        // Anonymous readers get teasers: excerpt in, gated fields out.
        if (!json.data?.excerpt) return null;
        if ('description' in (json.data || {})) return null;
        if ('skills' in (json.data || {})) return null;
        if ('applicationUrl' in (json.data || {})) return null;
        return `${title} | teaser ✓`;
      }
    )
  );

  results.push(
    await check('GET /companies', `${API_BASE}/companies`, (json) => {
      const list = json.data || [];
      if (!Array.isArray(list) || list.length === 0) return null;
      const hiring = list.filter((c) => (c.activeJobs || 0) > 0).length;
      const total = list.reduce((sum, c) => sum + (c.activeJobs || 0), 0);
      companySlug = list[0]?.slug || null;
      return `${list.length} companies, ${hiring} hiring, ${total} open India roles`;
    })
  );

  if (companySlug) {
    results.push(
      await check(
        'GET /companies/:slug',
        `${API_BASE}/companies/${companySlug}`,
        (json) => {
          const name = json.data?.name;
          const open = (json.data?.activeJobs ?? 0) + (json.data?.totalJobs ?? 0);
          return name ? `${name} (${open} open)` : null;
        }
      )
    );
  }

  results.push(
    await check('GET /sync-logs', `${API_BASE}/sync-logs?limit=3`, (json) => {
      const list = json.data || [];
      if (!Array.isArray(list) || list.length === 0) return 'no sync logs yet';
      const ok = list.filter((l) => l.status === 'success').length;
      return `${list.length} recent, ${ok} success`;
    })
  );

  results.push(
    await check(
      'GET /jobs?filter=techTrack',
      `${API_BASE}/jobs?limit=3&techTrack=ai-ml`,
      (json) => {
        const total = json.pagination?.total;
        return typeof total === 'number' ? `${total} AI/ML roles` : null;
      }
    )
  );

  results.push(
    await check(
      'GET /jobs?filter=skills',
      `${API_BASE}/jobs?limit=3&skills=aws`,
      (json) => {
        const total = json.pagination?.total;
        return typeof total === 'number' ? `${total} roles tagged aws` : null;
      }
    )
  );

  // Geo regression probe: ATS city-only "Malaysia"/"Kuala Lumpur" rows must
  // stay tagged non-India and never leak into the default India listing.
  // Single 100-row page covers the current board scale; revisit past ~100.
  results.push(
    await check('Malaysia geo probe', `${API_BASE}/jobs?limit=100`, async (json) => {
      const def = Array.isArray(json.data) ? json.data : null;
      if (!def) return null;
      let allRes;
      try {
        allRes = await fetch(`${API_BASE}/jobs?limit=100&indiaOnly=false`);
      } catch {
        return null;
      }
      if (!allRes.ok) return null;
      const all = await allRes.json().catch(() => null);
      if (!all || !Array.isArray(all.data)) return null;
      const isMalaysian = (job) =>
        (job.locations || []).some((loc) =>
          /malaysia|kuala lumpur/i.test(
            `${loc.city || ''} ${loc.state || ''} ${loc.country || ''}`
          )
        );
      const malaysian = all.data.filter(isMalaysian);
      if (malaysian.some((job) => job.isIndiaRole !== false)) return null;
      if (def.some(isMalaysian)) return null;
      return `${malaysian.length} Malaysia rows all non-India, 0 leak`;
    })
  );

  const failures = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  process.exit(failures > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Smoke run failed:', err.message);
  process.exit(1);
});
