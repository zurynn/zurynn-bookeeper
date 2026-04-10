import { Router } from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/register', authRateLimiter, authController.register);
router.get('/verify-email', authController.verifyEmail);
router.post('/login', authRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

export default router;
