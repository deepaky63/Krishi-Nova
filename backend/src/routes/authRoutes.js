import { Router } from 'express';
import { authRateLimit } from '../middleware/security.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { adminBootstrapSchema, loginSchema, registerSchema, verifyEmailSchema } from '../validators/auth.js';
import * as controller from '../controllers/authController.js';

const router = Router();
router.post('/register', authRateLimit, validate(registerSchema), asyncHandler(controller.register));
router.post('/login', authRateLimit, validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.post('/logout-all', authenticate, asyncHandler(controller.logoutAll));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(controller.verifyEmail));
router.post('/bootstrap', validate(adminBootstrapSchema), asyncHandler(controller.bootstrapAdmin));
router.post('/bootstrap-admin', validate(adminBootstrapSchema), asyncHandler(controller.bootstrapAdmin));
export default router;
