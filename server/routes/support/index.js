/**
 * routes/support/index.js
 * Mounts all support sub-routers.
 * 
 * Mount in app.js:
 *   import supportRouter from './routes/support/index.js';
 *   app.use('/api/support', supportRouter);
 *
 * Then in server.js after httpServer creation:
 *   import { initSupportSocket } from './socket/support.socket.js';
 *   const io = new Server(httpServer, { cors: { ... } });
 *   createAdapter(io);   // Redis adapter
 *   initSupportSocket(io);
 *   app.set('io', io);   // so req.io works in routes
 *
 * Middleware to inject io into req (add BEFORE routes in app.js):
 *   app.use((req, _res, next) => { req.io = app.get('io'); next(); });
 */

import express from 'express';

import ticketsRouter    from './tickets.routes.js';
import messagesRouter   from './messages.routes.js';
import adminRouter      from './admin.routes.js';
import uploadRouter     from './upload.routes.js';
import analyticsRouter  from './analytics.routes.js';

const router = express.Router();

// Tickets CRUD + status/priority/department/escalate/rate/delete
router.use('/tickets', ticketsRouter);

// Messages + internal notes + activity (nested under ticket)
// mergeParams: true is set inside messages.routes.js
router.use('/tickets/:ticketId/messages', messagesRouter);
router.use('/tickets/:ticketId',          messagesRouter); // for /internal-notes + /activity

// Admin operations
router.use('/admin', adminRouter);

// File upload
router.use('/upload', uploadRouter);

// Analytics
router.use('/analytics', analyticsRouter);

export default router;