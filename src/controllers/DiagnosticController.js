import Diagnostic from '../models/Diagnostic.js';
import { handleError } from '../utils/handleError.js';
import { logActivity } from '../utils/logActivity.js';
import { emailQueue } from '../queues/emailQueue.js';

class DiagnosticController {
  async store(req, res) {
    try {
      const {
        name,
        email,
        company,
        phone,
        segment,
        hasManualService,
        teamSize,
      } = req.body;

      const diagnostic = await Diagnostic.create({
        name,
        email,
        company,
        phone,
        segment,
        hasManualService,
        teamSize,
      });

      await logActivity({
        userId: req.userId,
        action: 'diagnostic.submitted',
        resourceType: 'diagnostic',
        resourceId: diagnostic.id,
        metadata: { company, segment },
        ip: req.ip,
      });

      await emailQueue.add('diagnostic-notification', {
        name,
        email,
        company,
        phone,
        segment,
        hasManualService,
        teamSize,
      });

      return res.status(201).json(diagnostic);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new DiagnosticController();
