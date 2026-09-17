import Company from '../models/company.model.js';
import Job from '../models/job.model.js';
import JobSource from '../models/jobSource.model.js';
import ApiError from '../utils/ApiError.js';
import TryCatch from '../middlewares/async.middleware.js';

export const createCompany = TryCatch(async (req, res) => {
  const company = await Company.create(req.validated);

  res.status(201).json({ success: true, data: company });
});

export const listCompanies = TryCatch(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const filter = includeInactive ? {} : { isActive: true };
  const companies = await Company.find(filter).sort({ name: 1 }).lean();

  // India-first: /jobs defaults to indiaOnly=true, so counts must match.
  // Pass ?indiaOnly=false to include non-India roles in counts.
  const indiaOnly = req.query.indiaOnly !== 'false';
  const match = indiaOnly
    ? { status: 'active', isIndiaRole: true }
    : { status: 'active' };
  // Single aggregation for live active-job counts (scales to many companies).
  const counts = await Job.aggregate([
    { $match: match },
    { $group: { _id: '$companyId', activeJobs: { $sum: 1 } } },
  ]);
  const countByCompany = new Map(counts.map((c) => [String(c._id), c.activeJobs]));

  res.status(200).json({
    success: true,
    data: companies.map((company) => ({
      ...company,
      activeJobs: countByCompany.get(String(company._id)) ?? 0,
    })),
  });
});

export const getCompanyBySlug = TryCatch(async (req, res) => {
  const company = await Company.findOne({ slug: req.params.slug }).lean();

  if (!company) throw new ApiError(404, 'Company not found');

  // Enrich with live counts + active sources so frontend company pages
  // need one request instead of three. Counts respect indiaOnly (default
  // true) so the header number always matches the jobs list.
  const indiaOnly = req.query.indiaOnly !== 'false';
  const jobMatch = indiaOnly
    ? { companyId: company._id, status: 'active', isIndiaRole: true }
    : { companyId: company._id, status: 'active' };
  const totalMatch = indiaOnly
    ? { companyId: company._id, isIndiaRole: true }
    : { companyId: company._id };
  const [activeJobs, totalJobs, sources] = await Promise.all([
    Job.countDocuments(jobMatch),
    Job.countDocuments(totalMatch),
    JobSource.find({ companyId: company._id, isActive: true })
      .select('name type careersUrl lastSuccessfulSyncAt')
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: { ...company, activeJobs, totalJobs, sources },
  });
});
