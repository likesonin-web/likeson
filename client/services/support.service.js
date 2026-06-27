/**
 * services/support.service.js
 *
 * Every Support REST call lives here, isolated from components/thunks per
 * the architecture brief ("No direct API calls inside components").
 * Mirrors routes/support/{tickets,messages,admin}.routes.js exactly.
 *
 * Uses the EXISTING axios instance (src/api.js) so JWT auth headers /
 * interceptors / autoLogout handling are inherited for free.
 */
import API from '@/store/api';
import { toQueryString } from '@/lib/supportutils';

// ─── Tickets ──────────────────────────────────────────────────────────────────

export const listTickets = (params = {}) => API.get(`/support/tickets${toQueryString(params)}`).then((r) => r.data);

export const getTicket = (id) => API.get(`/support/tickets/${id}`).then((r) => r.data);

export const createTicket = (payload) => API.post('/support/tickets', payload).then((r) => r.data);

export const updateTicketStatus = (id, payload) =>
  API.patch(`/support/tickets/${id}/status`, payload).then((r) => r.data);

export const updateTicketPriority = (id, priority) =>
  API.patch(`/support/tickets/${id}/priority`, { priority }).then((r) => r.data);

export const updateTicketDepartment = (id, department) =>
  API.patch(`/support/tickets/${id}/department`, { department }).then((r) => r.data);

export const escalateTicket = (id) => API.post(`/support/tickets/${id}/escalate`).then((r) => r.data);

export const deleteTicket = (id) => API.delete(`/support/tickets/${id}`).then((r) => r.data);

export const rateTicket = (id, payload) => API.post(`/support/tickets/${id}/rate`, payload).then((r) => r.data);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const listMessages = (ticketId, params = {}) =>
  API.get(`/support/tickets/${ticketId}/messages${toQueryString(params)}`).then((r) => r.data);

export const sendMessage = (ticketId, payload) =>
  API.post(`/support/tickets/${ticketId}/messages`, payload).then((r) => r.data);

export const markMessageRead = (ticketId, msgId) =>
  API.patch(`/support/tickets/${ticketId}/messages/${msgId}/read`).then((r) => r.data);

export const deleteMessage = (ticketId, msgId, payload = {}) =>
  API.delete(`/support/tickets/${ticketId}/messages/${msgId}`, { data: payload }).then((r) => r.data);

// ─── Internal Notes (admin / superadmin / finance only) ──────────────────────

export const listInternalNotes = (ticketId, params = {}) =>
  API.get(`/support/tickets/${ticketId}/internal-notes${toQueryString(params)}`).then((r) => r.data);

export const createInternalNote = (ticketId, payload) =>
  API.post(`/support/tickets/${ticketId}/internal-notes`, payload).then((r) => r.data);

// ─── Activity Timeline ────────────────────────────────────────────────────────

export const listActivity = (ticketId, params = {}) =>
  API.get(`/support/tickets/${ticketId}/activity${toQueryString(params)}`).then((r) => r.data);

// ─── Admin: assignment, bulk, merge, audit ───────────────────────────────────

export const assignAdmins = (ticketId, payload) =>
  API.post(`/support/admin/tickets/${ticketId}/assign`, payload).then((r) => r.data);

export const unassignAdmin = (ticketId, adminId) =>
  API.delete(`/support/admin/tickets/${ticketId}/assign/${adminId}`).then((r) => r.data);

export const bulkTicketAction = (payload) => API.post('/support/admin/tickets/bulk', payload).then((r) => r.data);

export const mergeTickets = (ticketId, targetTicketId) =>
  API.post(`/support/admin/tickets/${ticketId}/merge`, { targetTicketId }).then((r) => r.data);

export const getTicketAuditLog = (ticketId, params = {}) =>
  API.get(`/support/admin/tickets/${ticketId}/audit${toQueryString(params)}`).then((r) => r.data);

export const getAssignmentHistory = (ticketId) =>
  API.get(`/support/admin/tickets/${ticketId}/assignment-history`).then((r) => r.data);

export const addWatcher = (ticketId, userId) =>
  API.post(`/support/admin/tickets/${ticketId}/watchers`, { userId }).then((r) => r.data);

export const getGlobalAuditLogs = (params = {}) =>
  API.get(`/support/admin/audit-logs${toQueryString(params)}`).then((r) => r.data);

export const getAgents = (params = {}) => API.get(`/support/admin/agents${toQueryString(params)}`).then((r) => r.data);
