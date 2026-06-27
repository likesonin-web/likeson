/**
 * utils/support/slaCron.js
 * Run with node-cron or similar scheduler.
 * Checks SLA breaches every 30 min and fires notifications.
 *
 * Usage in app.js (after DB connect):
 *   import './utils/support/slaCron.js';
 */

import cron from 'node-cron';
import { Ticket } from '../../support/models/ticket.model.js'; // adjust path
import { createTicketNotification } from '../../support/utils/helpers.js';
import { TicketActivity } from '../../support/models/ticket.model.js';

// Every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('[SLA Cron] Running SLA breach check...');
  try {
    const now = new Date();

    // Tickets past SLA deadline, not yet resolved/closed, not already marked
    const breachedTickets = await Ticket.find({
      isDeleted: false,
      slaDeadline: { $lt: now },
      status: { $nin: ['RESOLVED', 'CLOSED'] },
      'metadata.slaBreadchNotified': { $ne: true },
    }).lean();

    if (!breachedTickets.length) return;

    for (const ticket of breachedTickets) {
      const notifyUsers = [
        ...(ticket.assignedAdmins || []),
        ticket.customer,
        ticket.partner,
      ].filter(Boolean);

      await createTicketNotification({
        recipients: notifyUsers,
        type: 'SLA_Breach',
        title: `SLA Breach: ${ticket.ticketNumber}`,
        body: `Ticket "${ticket.subject}" has breached its SLA deadline.`,
        ticketId: ticket._id,
      });

      await TicketActivity.create({
        ticket: ticket._id,
        actor: ticket.assignedAdmins?.[0] || ticket.createdBy,
        actorRole: 'system',
        action: 'SLA_BREACHED',
        metadata: { slaDeadline: ticket.slaDeadline, breachedAt: now },
      });

      // Mark as notified so we don't spam
      await Ticket.updateOne(
        { _id: ticket._id },
        { $set: { 'metadata.slaBreadchNotified': true } }
      );
    }

    console.log(`[SLA Cron] Processed ${breachedTickets.length} SLA breaches`);
  } catch (err) {
    console.error('[SLA Cron] Error:', err.message);
  }
});

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * REDIS ADAPTER SETUP (add to server.js)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * npm install @socket.io/redis-adapter
 *
 * import { createAdapter } from '@socket.io/redis-adapter';
 * import { createClient } from 'redis';
 * import { Server } from 'socket.io';
 *
 * const pubClient = createClient({ url: process.env.REDIS_URL });
 * const subClient = pubClient.duplicate();
 * await Promise.all([pubClient.connect(), subClient.connect()]);
 *
 * const io = new Server(httpServer, {
 *   cors: { origin: process.env.CLIENT_URL, credentials: true },
 *   transports: ['websocket', 'polling'],
 * });
 *
 * io.adapter(createAdapter(pubClient, subClient));
 *
 * import { initSupportSocket } from './socket/support.socket.js';
 * initSupportSocket(io);
 *
 * app.set('io', io);
 * app.use((req, _res, next) => { req.io = app.get('io'); next(); });
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * REQUIRED npm PACKAGES (add to package.json):
 *   express-rate-limit
 *   multer
 *   imagekit
 *   uuid
 *   @socket.io/redis-adapter
 *   node-cron
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * NOTIFICATION MODEL EXTENSION:
 * Add these types to the notification model's `type` enum array:
 *   'Ticket_Created', 'Ticket_Assigned', 'Ticket_Reassigned',
 *   'Ticket_Resolved', 'Ticket_Closed', 'Ticket_Reopened',
 *   'Ticket_Escalated', 'New_Ticket_Message', 'Ticket_Mention',
 *   'Ticket_Rated', 'SLA_Breach', 'Assignment_Changed',
 *   'Department_Changed', 'Priority_Changed'
 * ──────────────────────────────────────────────────────────────────────────────
 */