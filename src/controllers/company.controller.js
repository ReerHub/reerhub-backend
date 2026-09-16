import Company from '../models/company.model.js';
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

  res.status(200).json({ success: true, data: companies });
});

export const getCompanyBySlug = TryCatch(async (req, res) => {
  const company = await Company.findOne({ slug: req.params.slug }).lean();

  if (!company) throw new ApiError(404, 'Company not found');

  res.status(200).json({ success: true, data: company });
});
