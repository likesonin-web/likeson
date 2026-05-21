/**
 * cleanup.js — Resource cleanup helpers
 * Zero memory leak utilities for telemedicine room
 */

/**
 * Stop all tracks on a MediaStream.
 * @param {MediaStream|null} stream
 */
export function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try { track.stop(); } catch (_) {}
  });
}

/**
 * Create an AbortController and return controller + signal.
 * Caller stores controller.abort() in cleanup.
 */
export function createAbortController() {
  const controller = new AbortController();
  return { controller, signal: controller.signal };
}

/**
 * Clear a set of listener registrations.
 * Each entry is { target, event, handler }.
 * @param {Array<{target: EventTarget, event: string, handler: Function}>} listeners
 */
export function removeEventListeners(listeners) {
  for (const { target, event, handler } of listeners) {
    try { target?.removeEventListener(event, handler); } catch (_) {}
  }
}

/**
 * Clear interval + timeout refs safely.
 * @param  {...(number|NodeJS.Timeout|null|undefined)} ids
 */
export function clearTimers(...ids) {
  for (const id of ids) {
    if (id == null) continue;
    try { clearInterval(id); } catch (_) {}
    try { clearTimeout(id); } catch (_) {}
  }
}

/**
 * Build a stable socket-listener cleanup registry.
 * Returns { add, removeAll }.
 */
export function createListenerRegistry(socketOn, socketOff) {
  const registry = [];

  function add(event, handler) {
    socketOn(event, handler);
    registry.push({ event, handler });
  }

  function removeAll() {
    for (const { event, handler } of registry) {
      try { socketOff(event, handler); } catch (_) {}
    }
    registry.length = 0;
  }

  return { add, removeAll };
}