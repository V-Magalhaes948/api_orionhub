import { Router } from 'express';
import ConversationController from '../controllers/ConversationController.js';
import MessageController from '../controllers/MessageController.js';

const router = Router();

router.get('/:id', ConversationController.show);
router.put('/:id', ConversationController.update);
router.get('/:conversationId/messages', MessageController.index);

export default router;
