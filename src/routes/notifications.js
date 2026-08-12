import { Router } from 'express';

import NotificationController from '../controllers/NotificationController.js';
import { validate } from '../middlewares/validateJson.js';
import {
  listNotificationsSchema,
  markAllReadSchema,
} from '../schemas/notificationsSchemas.js';

const router = Router();

router.get(
  '/',
  validate(listNotificationsSchema),
  NotificationController.index
);
router.post(
  '/mark-read',
  validate(markAllReadSchema),
  NotificationController.markAllRead
);

export default router;
