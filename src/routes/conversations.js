import { Router } from 'express';

import ConversationController from '../controllers/ConversationController.js';
import MessageController from '../controllers/MessageController.js';
import { cacheMiddleware } from '../middlewares/cache.js';
import { validate } from '../middlewares/validateJson.js';
import {
  listConversationsSchema,
  updateConversationSchema,
} from '../schemas/conversationSchemas.js';
import {
  listMessagesSchema,
  storeMessageSchema,
} from '../schemas/messageSchemas.js';
import { uuidParam } from '../schemas/common.js';

const router = Router();

router.get(
  '/',
  cacheMiddleware(30),
  validate(listConversationsSchema),
  ConversationController.index
);
router.get(
  '/:id',
  validate({ params: uuidParam() }),
  ConversationController.show
);
router.patch(
  '/:id',
  validate(updateConversationSchema),
  ConversationController.update
);
router.get(
  '/:conversationId/messages',
  cacheMiddleware(20),
  validate(listMessagesSchema),
  MessageController.index
);
router.post(
  '/:conversationId/messages',
  validate(storeMessageSchema),
  MessageController.store
);
router.patch(
  '/:id/resume',
  validate({ params: uuidParam() }),
  ConversationController.resume
);

export default router;
