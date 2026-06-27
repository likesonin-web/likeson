import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';

import * as supportApi from '@/services/support.service';
import * as uploadApi from '@/services/upload.service';
import * as analyticsApi from '@/services/analytics.service';
import { cacheKeyFor } from '@/lib/supportutils';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  ERROR EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════════

const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  tickets: {
    items: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 1 },
    loading: false,
    error: null,
  },
  currentTicket: {
    data: null,
    loading: false,
    error: null,
  },
  messagesByTicket: {},
  attachmentsByTicket: {},
  internalNotesByTicket: {},
  activityByTicket: {},
  activeUsersByTicket: {},
  typingUsersByTicket: {},
  ticketFilters: {
    scope: 'all',
    status: '',
    priority: '',
    department: '',
    search: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 20,
  },
  unreadByTicket: {},
  totalUnreadTickets: 0,
  uploadQueue: {},
  agents: { items: [], loading: false, error: null },
  analytics: {
    overview: null,
    adminPerformance: [],
    partnerTrends: [],
    customerTrends: [],
    topTags: [],
    slaBreachReport: { items: [], pagination: { page: 1, limit: 20, total: 0 } },
    loading: false,
    error: null,
    fetchedAt: {},
  },
  socketConnected: false,
  socketReconnecting: false,
  loading: false,
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  THUNKS — Tickets
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchTickets = createAsyncThunk(
  'support/fetchTickets',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await supportApi.listTickets(params);
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not load tickets.'));
    }
  }
);

export const fetchTicketById = createAsyncThunk(
  'support/fetchTicketById',
  async (id, { rejectWithValue }) => {
    try {
      return await supportApi.getTicket(id);
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not load this ticket.'));
    }
  }
);

export const createTicket = createAsyncThunk(
  'support/createTicket',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await supportApi.createTicket(payload);
      toast.success(`Ticket ${data.data?.ticketNumber ?? ''} created.`);
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not create ticket.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateTicketStatus = createAsyncThunk(
  'support/updateTicketStatus',
  async ({ id, status, reason }, { rejectWithValue }) => {
    try {
      const data = await supportApi.updateTicketStatus(id, { status, reason });
      toast.success(`Ticket marked ${status.replace(/_/g, ' ').toLowerCase()}.`);
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not update ticket status.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateTicketPriority = createAsyncThunk(
  'support/updateTicketPriority',
  async ({ id, priority }, { rejectWithValue }) => {
    try {
      const data = await supportApi.updateTicketPriority(id, priority);
      toast.success(`Priority changed to ${priority}.`);
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not change priority.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateTicketDepartment = createAsyncThunk(
  'support/updateTicketDepartment',
  async ({ id, department }, { rejectWithValue }) => {
    try {
      const data = await supportApi.updateTicketDepartment(id, department);
      toast.success('Department updated.');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not change department.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const escalateTicket = createAsyncThunk(
  'support/escalateTicket',
  async (id, { rejectWithValue }) => {
    try {
      const data = await supportApi.escalateTicket(id);
      toast.success('Ticket escalated to CRITICAL.');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not escalate ticket.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteTicket = createAsyncThunk(
  'support/deleteTicket',
  async (id, { rejectWithValue }) => {
    try {
      await supportApi.deleteTicket(id);
      toast.success('Ticket deleted.');
      return id;
    } catch (err) {
      const msg = extractError(err, 'Could not delete ticket.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const rateTicket = createAsyncThunk(
  'support/rateTicket',
  async ({ id, rating, review }, { rejectWithValue }) => {
    try {
      const data = await supportApi.rateTicket(id, { rating, review });
      toast.success('Thanks for rating this ticket!');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not submit rating.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  THUNKS — Messages, Internal Notes, Activity
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchMessages = createAsyncThunk(
  'support/fetchMessages',
  async ({ ticketId, page = 1, limit = 30 }, { rejectWithValue }) => {
    try {
      const data = await supportApi.listMessages(ticketId, { page, limit });
      return { ticketId, ...data };
    } catch (err) {
      return rejectWithValue({ ticketId, message: extractError(err, 'Could not load messages.') });
    }
  }
);

export const sendMessage = createAsyncThunk(
  'support/sendMessage',
  async ({ ticketId, ...payload }, { dispatch, getState, rejectWithValue }) => {
    // Optimistic add — show message immediately before API responds
    const user = getState().user?.currentUser ?? getState().auth?.user ?? null;
    const localId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimisticMsg = {
      _id: localId,
      ticket: ticketId,
      sender: user,
      senderRole: user?.role ?? 'customer',
      message: payload.message ?? '',
      messageType: payload.messageType ?? 'TEXT',
      attachments: payload.attachments ?? [],
      mentions: payload.mentions ?? [],
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    dispatch(messageReceivedRealtime({ ticketId, message: optimisticMsg }));

    try {
      const data = await supportApi.sendMessage(ticketId, payload);
      return { ticketId, localId, ...data };
    } catch (err) {
      const msg = extractError(err, 'Message failed to send.');
      toast.error(msg);
      dispatch(messageDeletedRealtime({ ticketId, msgId: localId }));
      return rejectWithValue({ ticketId, message: msg });
    }
  }
);

export const markMessageRead = createAsyncThunk(
  'support/markMessageRead',
  async ({ ticketId, msgId }, { rejectWithValue }) => {
    try {
      await supportApi.markMessageRead(ticketId, msgId);
      return { ticketId, msgId };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const deleteMessage = createAsyncThunk(
  'support/deleteMessage',
  async ({ ticketId, msgId, deleteReason }, { rejectWithValue }) => {
    try {
      await supportApi.deleteMessage(ticketId, msgId, { deleteReason });
      toast.success('Message removed.');
      return { ticketId, msgId };
    } catch (err) {
      const msg = extractError(err, 'Could not delete message.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchInternalNotes = createAsyncThunk(
  'support/fetchInternalNotes',
  async ({ ticketId, page = 1, limit = 30 }, { rejectWithValue }) => {
    try {
      const data = await supportApi.listInternalNotes(ticketId, { page, limit });
      return { ticketId, ...data };
    } catch (err) {
      return rejectWithValue({ ticketId, message: extractError(err) });
    }
  }
);

export const createInternalNote = createAsyncThunk(
  'support/createInternalNote',
  async ({ ticketId, ...payload }, { rejectWithValue }) => {
    try {
      const data = await supportApi.createInternalNote(ticketId, payload);
      toast.success('Internal note added.');
      return { ticketId, ...data };
    } catch (err) {
      const msg = extractError(err, 'Could not add internal note.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchActivity = createAsyncThunk(
  'support/fetchActivity',
  async ({ ticketId, page = 1, limit = 50 }, { rejectWithValue }) => {
    try {
      const data = await supportApi.listActivity(ticketId, { page, limit });
      return { ticketId, ...data };
    } catch (err) {
      return rejectWithValue({ ticketId, message: extractError(err) });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  THUNKS — Admin
// ═══════════════════════════════════════════════════════════════════════════════

export const assignAdmins = createAsyncThunk(
  'support/assignAdmins',
  async ({ ticketId, adminIds, reason, type }, { rejectWithValue }) => {
    try {
      const data = await supportApi.assignAdmins(ticketId, { adminIds, reason, type });
      toast.success('Ticket assigned.');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not assign ticket.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const unassignAdmin = createAsyncThunk(
  'support/unassignAdmin',
  async ({ ticketId, adminId }, { rejectWithValue }) => {
    try {
      const data = await supportApi.unassignAdmin(ticketId, adminId);
      toast.success('Admin unassigned.');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not unassign admin.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const bulkTicketAction = createAsyncThunk(
  'support/bulkTicketAction',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await supportApi.bulkTicketAction(payload);
      toast.success(`${data.modifiedCount ?? 0} ticket(s) updated.`);
      return data;
    } catch (err) {
      const msg = extractError(err, 'Bulk action failed.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const mergeTickets = createAsyncThunk(
  'support/mergeTickets',
  async ({ ticketId, targetTicketId }, { rejectWithValue }) => {
    try {
      const data = await supportApi.mergeTickets(ticketId, targetTicketId);
      toast.success(data.message ?? 'Tickets merged.');
      return { ticketId, ...data };
    } catch (err) {
      const msg = extractError(err, 'Could not merge tickets.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchAgents = createAsyncThunk(
  'support/fetchAgents',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await supportApi.getAgents(params);
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not load agents.'));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  THUNKS — Uploads
// ═══════════════════════════════════════════════════════════════════════════════

export const uploadTicketAttachment = createAsyncThunk(
  'support/uploadTicketAttachment',
  async ({ ticketId, file, context = 'message', localId }, { dispatch, rejectWithValue }) => {
    try {
      const data = await uploadApi.uploadAttachment(ticketId, file, context, (progress) => {
        dispatch(supportSlice.actions.setUploadProgress({ localId, progress }));
      });
      return { ticketId, localId, attachment: data.data };
    } catch (err) {
      const msg = extractError(err, 'Upload failed.');
      return rejectWithValue({ localId, message: msg });
    }
  }
);

export const fetchAttachments = createAsyncThunk(
  'support/fetchAttachments',
  async (ticketId, { rejectWithValue }) => {
    try {
      const data = await uploadApi.listAttachments(ticketId);
      return { ticketId, ...data };
    } catch (err) {
      return rejectWithValue({ ticketId, message: extractError(err) });
    }
  }
);

export const deleteAttachment = createAsyncThunk(
  'support/deleteAttachment',
  async ({ ticketId, attachmentId }, { rejectWithValue }) => {
    try {
      await uploadApi.deleteAttachment(attachmentId);
      toast.success('Attachment removed.');
      return { ticketId, attachmentId };
    } catch (err) {
      const msg = extractError(err, 'Could not delete attachment.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  THUNKS — Analytics
// ═══════════════════════════════════════════════════════════════════════════════

function makeAnalyticsThunk(name, apiFn, cachePrefix) {
  return createAsyncThunk(`support/${name}`, async (params = {}, { getState, rejectWithValue }) => {
    const { force, ...query } = params;
    const cacheKey = cacheKeyFor(cachePrefix, query);
    const lastFetched = getState().support.analytics.fetchedAt[cacheKey];

    if (!force && lastFetched && Date.now() - lastFetched < ANALYTICS_CACHE_TTL_MS) {
      return { skipped: true, cacheKey };
    }

    try {
      const data = await apiFn(query);
      return { ...data, cacheKey };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not load analytics.'));
    }
  });
}

export const fetchAnalyticsOverview  = makeAnalyticsThunk('fetchAnalyticsOverview',  analyticsApi.getOverview,         'overview');
export const fetchAdminPerformance   = makeAnalyticsThunk('fetchAdminPerformance',   analyticsApi.getAdminPerformance, 'adminPerformance');
export const fetchPartnerTrends      = makeAnalyticsThunk('fetchPartnerTrends',      analyticsApi.getPartnerTrends,    'partnerTrends');
export const fetchCustomerTrends     = makeAnalyticsThunk('fetchCustomerTrends',     analyticsApi.getCustomerTrends,   'customerTrends');
export const fetchTopTags            = makeAnalyticsThunk('fetchTopTags',            analyticsApi.getTopTags,          'topTags');
export const fetchSlaBreachReport    = makeAnalyticsThunk('fetchSlaBreachReport',    analyticsApi.getSlaBreachReport,  'slaBreachReport');

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const supportSlice = createSlice({
  name: 'support',
  initialState,

  reducers: {
    setTicketFilters: (state, action) => {
      state.ticketFilters = { ...state.ticketFilters, ...action.payload };
    },
    resetTicketFilters: (state) => {
      state.ticketFilters = initialState.ticketFilters;
    },

    setSocketConnected: (state, action) => {
      state.socketConnected = action.payload;
      if (action.payload) state.socketReconnecting = false;
    },
    setSocketReconnecting: (state, action) => {
      state.socketReconnecting = action.payload;
    },

    ticketCreatedRealtime: (state, action) => {
      const incoming = action.payload;
      const exists = state.tickets.items.some((t) => t._id === incoming.ticketId);
      if (!exists) {
        state.tickets.items.unshift({
          _id: incoming.ticketId,
          ticketNumber: incoming.ticketNumber,
          subject: incoming.subject,
          department: incoming.department,
          status: 'OPEN',
          priority: 'MEDIUM',
          createdAt: new Date().toISOString(),
        });
        state.tickets.pagination.total += 1;
      }
    },

    ticketPatchedRealtime: (state, action) => {
      const { ticketId, patch } = action.payload;
      const idx = state.tickets.items.findIndex((t) => t._id === ticketId);
      if (idx !== -1) state.tickets.items[idx] = { ...state.tickets.items[idx], ...patch };
      if (state.currentTicket.data?._id === ticketId) {
        state.currentTicket.data = { ...state.currentTicket.data, ...patch };
      }
    },

    // Also used for optimistic adds (_optimistic: true) — dedup by _id
    messageReceivedRealtime: (state, action) => {
      const { ticketId, message } = action.payload;
      if (!state.messagesByTicket[ticketId]) {
        state.messagesByTicket[ticketId] = { items: [], pagination: {}, loading: false, hasMore: false };
      }
      const bucket = state.messagesByTicket[ticketId];
      const existingIdx = bucket.items.findIndex((m) => m._id === message._id);
      if (existingIdx === -1) {
        bucket.items.push(message);
      } else {
        bucket.items[existingIdx] = message;
      }
      if (!message._optimistic) {
        const tIdx = state.tickets.items.findIndex((t) => t._id === ticketId);
        if (tIdx !== -1) {
          state.tickets.items[tIdx].lastMessageAt = message.createdAt;
          state.tickets.items[tIdx].lastMessagePreview = message.message;
        }
      }
    },

    messageDeletedRealtime: (state, action) => {
      const { ticketId, msgId } = action.payload;
      const bucket = state.messagesByTicket[ticketId];
      if (bucket) bucket.items = bucket.items.filter((m) => m._id !== msgId);
    },

    messageDeliveredRealtime: (state, action) => {
      const { ticketId, messageId, deliveredTo } = action.payload;
      const bucket = state.messagesByTicket[ticketId];
      const msg = bucket?.items.find((m) => m._id === messageId);
      if (msg) {
        msg.deliveredTo = msg.deliveredTo || [];
        if (!msg.deliveredTo.some((d) => d.user === deliveredTo)) {
          msg.deliveredTo.push({ user: deliveredTo, deliveredAt: new Date().toISOString() });
        }
      }
    },

    messageReadRealtime: (state, action) => {
      const { ticketId, messageId, readBy } = action.payload;
      const bucket = state.messagesByTicket[ticketId];
      const msg = bucket?.items.find((m) => m._id === messageId);
      if (msg) {
        msg.readBy = msg.readBy || [];
        if (!msg.readBy.some((r) => r.user === readBy)) {
          msg.readBy.push({ user: readBy, readAt: new Date().toISOString() });
        }
      }
    },

    internalNoteCreatedRealtime: (state, action) => {
      const { ticketId } = action.payload;
      const bucket = state.internalNotesByTicket[ticketId];
      if (bucket) bucket.staleFlag = true;
    },

    attachmentUploadedRealtime: (state, action) => {
      const { ticketId, attachment } = action.payload;
      const list = state.attachmentsByTicket[ticketId] || [];
      if (!list.some((a) => a._id === attachment._id)) list.unshift(attachment);
      state.attachmentsByTicket[ticketId] = list;
    },

    setActiveUsers: (state, action) => {
      const { ticketId, userIds } = action.payload;
      state.activeUsersByTicket[ticketId] = userIds;
    },

    setTypingUser: (state, action) => {
      const { ticketId, userId, userName } = action.payload;
      if (!state.typingUsersByTicket[ticketId]) state.typingUsersByTicket[ticketId] = {};
      state.typingUsersByTicket[ticketId][userId] = userName;
    },

    clearTypingUser: (state, action) => {
      const { ticketId, userId } = action.payload;
      if (state.typingUsersByTicket[ticketId]) delete state.typingUsersByTicket[ticketId][userId];
    },

    addUploadQueueItem: (state, action) => {
      const { localId, fileName } = action.payload;
      state.uploadQueue[localId] = { fileName, progress: 0, status: 'uploading' };
    },
    setUploadProgress: (state, action) => {
      const { localId, progress } = action.payload;
      if (state.uploadQueue[localId]) state.uploadQueue[localId].progress = progress;
    },
    removeUploadQueueItem: (state, action) => {
      delete state.uploadQueue[action.payload];
    },

    clearCurrentTicket: (state) => {
      state.currentTicket = { data: null, loading: false, error: null };
    },
    clearSupportError: (state) => {
      state.error = null;
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // RULE: ALL addCase calls MUST come before ANY addMatcher call (RTK constraint).
  // The two addMatcher blocks (ticket-patch group + analytics-pending/rejected)
  // are therefore placed at the very end of the builder chain.
  // ─────────────────────────────────────────────────────────────────────────────
  extraReducers: (builder) => {
    builder

      // ── fetchTickets ──────────────────────────────────────────────────────
      .addCase(fetchTickets.pending, (state) => {
        state.tickets.loading = true;
        state.tickets.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.tickets.loading = false;
        const { data, pagination } = action.payload;
        if (pagination?.page > 1) {
          const existingIds = new Set(state.tickets.items.map((t) => t._id));
          state.tickets.items.push(...data.filter((t) => !existingIds.has(t._id)));
        } else {
          state.tickets.items = data;
        }
        state.tickets.pagination = pagination ?? state.tickets.pagination;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.tickets.loading = false;
        state.tickets.error = action.payload;
      })

      // ── fetchTicketById ───────────────────────────────────────────────────
      .addCase(fetchTicketById.pending, (state) => {
        state.currentTicket.loading = true;
        state.currentTicket.error = null;
      })
      .addCase(fetchTicketById.fulfilled, (state, action) => {
        state.currentTicket.loading = false;
        state.currentTicket.data = action.payload.data;
      })
      .addCase(fetchTicketById.rejected, (state, action) => {
        state.currentTicket.loading = false;
        state.currentTicket.error = action.payload;
      })

      // ── createTicket ──────────────────────────────────────────────────────
      .addCase(createTicket.fulfilled, (state, action) => {
        state.tickets.items.unshift(action.payload.data);
        state.tickets.pagination.total += 1;
      })

      // ── deleteTicket ──────────────────────────────────────────────────────
      .addCase(deleteTicket.fulfilled, (state, action) => {
        state.tickets.items = state.tickets.items.filter((t) => t._id !== action.payload);
        if (state.currentTicket.data?._id === action.payload) state.currentTicket.data = null;
      })

      // ── fetchMessages ─────────────────────────────────────────────────────
      .addCase(fetchMessages.pending, (state, action) => {
        const { ticketId } = action.meta.arg;
        const bucket = state.messagesByTicket[ticketId] || { items: [], pagination: {}, hasMore: true };
        bucket.loading = true;
        bucket.error = null;
        state.messagesByTicket[ticketId] = bucket;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { ticketId, data, pagination } = action.payload;
        const bucket = state.messagesByTicket[ticketId] || { items: [] };
        bucket.loading = false;
        bucket.pagination = pagination;
        bucket.hasMore = pagination ? pagination.page < pagination.pages : false;
        if (pagination?.page > 1) {
          const existingIds = new Set(bucket.items.map((m) => m._id));
          bucket.items = [...data.filter((m) => !existingIds.has(m._id)), ...bucket.items];
        } else {
          bucket.items = data;
        }
        state.messagesByTicket[ticketId] = bucket;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const { ticketId, message } = action.payload || {};
        if (ticketId && state.messagesByTicket[ticketId]) {
          state.messagesByTicket[ticketId].loading = false;
          state.messagesByTicket[ticketId].error = message;
        }
      })

      // ── sendMessage — replace optimistic placeholder with real response ───
      .addCase(sendMessage.fulfilled, (state, action) => {
        const { ticketId, localId, data } = action.payload;
        const bucket = state.messagesByTicket[ticketId] || { items: [], pagination: {}, hasMore: false };
        if (localId) {
          const idx = bucket.items.findIndex((m) => m._id === localId);
          if (idx !== -1) {
            bucket.items[idx] = data;
          } else {
            const exists = bucket.items.some((m) => m._id === data._id);
            if (!exists) bucket.items.push(data);
          }
        } else {
          const exists = bucket.items.some((m) => m._id === data._id);
          if (!exists) bucket.items.push(data);
        }
        state.messagesByTicket[ticketId] = bucket;
        const tIdx = state.tickets.items.findIndex((t) => t._id === ticketId);
        if (tIdx !== -1) {
          state.tickets.items[tIdx].lastMessageAt = data.createdAt;
          state.tickets.items[tIdx].lastMessagePreview = data.message;
        }
      })

      // ── deleteMessage ─────────────────────────────────────────────────────
      .addCase(deleteMessage.fulfilled, (state, action) => {
        const { ticketId, msgId } = action.payload;
        const bucket = state.messagesByTicket[ticketId];
        if (bucket) bucket.items = bucket.items.filter((m) => m._id !== msgId);
      })

      // ── fetchInternalNotes ────────────────────────────────────────────────
      .addCase(fetchInternalNotes.pending, (state, action) => {
        const { ticketId } = action.meta.arg;
        state.internalNotesByTicket[ticketId] = state.internalNotesByTicket[ticketId] || { items: [] };
        state.internalNotesByTicket[ticketId].loading = true;
      })
      .addCase(fetchInternalNotes.fulfilled, (state, action) => {
        const { ticketId, data } = action.payload;
        state.internalNotesByTicket[ticketId] = { items: data, loading: false, staleFlag: false };
      })

      // ── createInternalNote ────────────────────────────────────────────────
      .addCase(createInternalNote.fulfilled, (state, action) => {
        const { ticketId, data } = action.payload;
        const bucket = state.internalNotesByTicket[ticketId] || { items: [] };
        bucket.items.unshift(data);
        state.internalNotesByTicket[ticketId] = bucket;
      })

      // ── fetchActivity ─────────────────────────────────────────────────────
      .addCase(fetchActivity.pending, (state, action) => {
        const { ticketId } = action.meta.arg;
        state.activityByTicket[ticketId] = state.activityByTicket[ticketId] || { items: [] };
        state.activityByTicket[ticketId].loading = true;
      })
      .addCase(fetchActivity.fulfilled, (state, action) => {
        const { ticketId, data, pagination } = action.payload;
        state.activityByTicket[ticketId] = { items: data, pagination, loading: false };
      })

      // ── fetchAgents ───────────────────────────────────────────────────────
      .addCase(fetchAgents.pending, (state) => {
        state.agents.loading = true;
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.agents.loading = false;
        state.agents.items = action.payload.data ?? [];
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.agents.loading = false;
        state.agents.error = action.payload;
      })

      // ── uploadTicketAttachment ────────────────────────────────────────────
      .addCase(uploadTicketAttachment.pending, (state, action) => {
        const { localId, file } = action.meta.arg;
        state.uploadQueue[localId] = { fileName: file?.name, progress: 0, status: 'uploading' };
      })
      .addCase(uploadTicketAttachment.fulfilled, (state, action) => {
        const { ticketId, localId, attachment } = action.payload;
        if (state.uploadQueue[localId]) {
          state.uploadQueue[localId].status = 'done';
          state.uploadQueue[localId].progress = 100;
          state.uploadQueue[localId].attachment = attachment;
        }
        const list = state.attachmentsByTicket[ticketId] || [];
        list.unshift(attachment);
        state.attachmentsByTicket[ticketId] = list;
      })
      .addCase(uploadTicketAttachment.rejected, (state, action) => {
        const { localId, message } = action.payload || {};
        if (localId && state.uploadQueue[localId]) {
          state.uploadQueue[localId].status = 'error';
          state.uploadQueue[localId].error = message;
        }
      })

      // ── fetchAttachments ──────────────────────────────────────────────────
      .addCase(fetchAttachments.fulfilled, (state, action) => {
        const { ticketId, data } = action.payload;
        state.attachmentsByTicket[ticketId] = data;
      })

      // ── deleteAttachment ──────────────────────────────────────────────────
      .addCase(deleteAttachment.fulfilled, (state, action) => {
        const { ticketId, attachmentId } = action.payload;
        const list = state.attachmentsByTicket[ticketId];
        if (list) state.attachmentsByTicket[ticketId] = list.filter((a) => a._id !== attachmentId);
      })

      // ── Analytics fulfilled ───────────────────────────────────────────────
      .addCase(fetchAnalyticsOverview.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (action.payload.skipped) return;
        state.analytics.overview = action.payload.data;
        state.analytics.fetchedAt[action.payload.cacheKey] = Date.now();
      })
      .addCase(fetchAdminPerformance.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (action.payload.skipped) return;
        state.analytics.adminPerformance = action.payload.data;
        state.analytics.fetchedAt[action.payload.cacheKey] = Date.now();
      })
      .addCase(fetchPartnerTrends.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (action.payload.skipped) return;
        state.analytics.partnerTrends = action.payload.data;
        state.analytics.fetchedAt[action.payload.cacheKey] = Date.now();
      })
      .addCase(fetchCustomerTrends.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (action.payload.skipped) return;
        state.analytics.customerTrends = action.payload.data;
        state.analytics.fetchedAt[action.payload.cacheKey] = Date.now();
      })
      .addCase(fetchTopTags.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (action.payload.skipped) return;
        state.analytics.topTags = action.payload.data;
        state.analytics.fetchedAt[action.payload.cacheKey] = Date.now();
      })
      .addCase(fetchSlaBreachReport.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (action.payload.skipped) return;
        state.analytics.slaBreachReport = {
          items: action.payload.data,
          pagination: action.payload.pagination,
        };
        state.analytics.fetchedAt[action.payload.cacheKey] = Date.now();
      })

      // ══════════════════════════════════════════════════════════════════════
      // addMatcher blocks MUST be last — RTK throws if any addCase follows
      // ══════════════════════════════════════════════════════════════════════

      // ── Ticket patch group (status / priority / department / assign / escalate)
      .addMatcher(
        (a) =>
          [
            updateTicketStatus.fulfilled.type,
            updateTicketPriority.fulfilled.type,
            updateTicketDepartment.fulfilled.type,
            escalateTicket.fulfilled.type,
            assignAdmins.fulfilled.type,
            unassignAdmin.fulfilled.type,
          ].includes(a.type),
        (state, action) => {
          const updated = action.payload?.data;
          if (!updated?._id) return;
          const idx = state.tickets.items.findIndex((t) => t._id === updated._id);
          if (idx !== -1) state.tickets.items[idx] = { ...state.tickets.items[idx], ...updated };
          if (state.currentTicket.data?._id === updated._id) {
            state.currentTicket.data = { ...state.currentTicket.data, ...updated };
          }
        }
      )

      // ── Analytics pending
      .addMatcher(
        (a) =>
          [
            fetchAnalyticsOverview.pending.type,
            fetchAdminPerformance.pending.type,
            fetchPartnerTrends.pending.type,
            fetchCustomerTrends.pending.type,
            fetchTopTags.pending.type,
            fetchSlaBreachReport.pending.type,
          ].includes(a.type),
        (state) => {
          state.analytics.loading = true;
          state.analytics.error = null;
        }
      )

      // ── Analytics rejected
      .addMatcher(
        (a) =>
          [
            fetchAnalyticsOverview.rejected.type,
            fetchAdminPerformance.rejected.type,
            fetchPartnerTrends.rejected.type,
            fetchCustomerTrends.rejected.type,
            fetchTopTags.rejected.type,
            fetchSlaBreachReport.rejected.type,
          ].includes(a.type),
        (state, action) => {
          state.analytics.loading = false;
          state.analytics.error = action.payload;
        }
      );
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// § 9  SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

export const selectTicketsState    = (s) => s.support.tickets;
export const selectTicketFilters   = (s) => s.support.ticketFilters;
export const selectCurrentTicket   = (s) => s.support.currentTicket;
export const selectMessagesFor     = (ticketId) => (s) =>
  s.support.messagesByTicket[ticketId] || { items: [], pagination: {}, loading: false, hasMore: false };
export const selectInternalNotesFor = (ticketId) => (s) =>
  s.support.internalNotesByTicket[ticketId] || { items: [], loading: false };
export const selectActivityFor     = (ticketId) => (s) =>
  s.support.activityByTicket[ticketId] || { items: [], loading: false };
export const selectAttachmentsFor  = (ticketId) => (s) =>
  s.support.attachmentsByTicket[ticketId] || [];
export const selectActiveUsersFor  = (ticketId) => (s) =>
  s.support.activeUsersByTicket[ticketId] || [];
export const selectTypingUsersFor  = (ticketId) => (s) =>
  s.support.typingUsersByTicket[ticketId] || {};
export const selectAgents          = (s) => s.support.agents;
export const selectAnalytics       = (s) => s.support.analytics;
export const selectSocketConnected = (s) => s.support.socketConnected;
export const selectUploadQueue     = (s) => s.support.uploadQueue;

export const {
  setTicketFilters,
  resetTicketFilters,
  setSocketConnected,
  setSocketReconnecting,
  ticketCreatedRealtime,
  ticketPatchedRealtime,
  messageReceivedRealtime,
  messageDeletedRealtime,
  messageDeliveredRealtime,
  messageReadRealtime,
  internalNoteCreatedRealtime,
  attachmentUploadedRealtime,
  setActiveUsers,
  setTypingUser,
  clearTypingUser,
  addUploadQueueItem,
  setUploadProgress,
  removeUploadQueueItem,
  clearCurrentTicket,
  clearSupportError,
} = supportSlice.actions;

export default supportSlice.reducer;