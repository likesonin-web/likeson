/**
 * services/analytics.service.js
 *
 * Wraps routes/support/analytics.routes.js. All endpoints accept an
 * optional { startDate, endDate } window; the server defaults to the
 * trailing 30 days when omitted and caches results in Redis for 5 min,
 * so the frontend can call these freely without its own debouncing.
 */
import API from '@/store/api';
import { toQueryString } from '@/lib/supportutils';

export const getOverview = (params = {}) =>
  API.get(`/support/analytics/overview${toQueryString(params)}`).then((r) => r.data);

export const getAdminPerformance = (params = {}) =>
  API.get(`/support/analytics/admin-performance${toQueryString(params)}`).then((r) => r.data);

export const getPartnerTrends = (params = {}) =>
  API.get(`/support/analytics/partner-trends${toQueryString(params)}`).then((r) => r.data);

export const getCustomerTrends = (params = {}) =>
  API.get(`/support/analytics/customer-trends${toQueryString(params)}`).then((r) => r.data);

export const getTopTags = (params = {}) =>
  API.get(`/support/analytics/top-tags${toQueryString(params)}`).then((r) => r.data);

export const getSlaBreachReport = (params = {}) =>
  API.get(`/support/analytics/sla-breach-report${toQueryString(params)}`).then((r) => r.data);
