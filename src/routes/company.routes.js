import express from 'express';

import {
  createCompany,
  getCompanyBySlug,
  listCompanies,
} from '../controllers/company.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createCompanySchema } from '../validators/company.schema.js';

const router = express.Router();

router.route('/').get(listCompanies).post(validate(createCompanySchema), createCompany);
router.get('/:slug', getCompanyBySlug);

export default router;
