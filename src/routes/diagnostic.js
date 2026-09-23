import { Router } from 'express';

import DiagnosticController from '../controllers/DiagnosticController.js';
import { validate } from '../middlewares/validateJson.js';
import { createDiagnosticSchema } from '../schemas/diagnosticSchema.js';

const router = Router();

router.post('/', validate(createDiagnosticSchema), DiagnosticController.store);

export default router;
