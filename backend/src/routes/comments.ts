import { Router } from 'express';
import { 
  getComments, 
  createComment, 
  updateComment, 
  deleteComment 
} from '../controllers/commentController';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createCommentSchema, updateCommentSchema } from '../schemas/commentSchemas';

const router = Router();

// Public routes
router.get('/post/:postId', optionalAuth, getComments);

// Protected routes
router.post('/', authenticateToken, validateRequest(createCommentSchema), createComment);
router.put('/:id', authenticateToken, validateRequest(updateCommentSchema), updateComment);
router.delete('/:id', authenticateToken, deleteComment);

export default router;