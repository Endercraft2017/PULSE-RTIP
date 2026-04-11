/* ============================================================
   Electron Preload Script
   ============================================================
   Table of Contents:
   1. Context bridge API exposure
   ============================================================

   Security: This is the ONLY bridge between the renderer
   (frontend SPA) and the main process (Node.js).

   contextIsolation: true ensures the renderer cannot access
   Node.js APIs directly. All IPC goes through validated
   channel whitelists below.
   ============================================================ */

const { contextBridge, ipcRenderer } = require('electron');

/* --------------------------------------------------------
   1. Context Bridge API
   -------------------------------------------------------- */

/**
 * Whitelist of allowed IPC channels.
 * Every new channel MUST be registered here.
 */
const VALID_INVOKE_CHANNELS = [
    // 'db:query',
    // 'db:insert',
    // 'notify'
];

const VALID_SEND_CHANNELS = [];
const VALID_RECEIVE_CHANNELS = [];

contextBridge.exposeInMainWorld('electronAPI', {
    /** Environment detection */
    isElectron: true,
    platform: process.platform,

    /**
     * Invoke a main process handler (request-response pattern).
     * Only whitelisted channels are allowed.
     */
    invoke: (channel, ...args) => {
        if (VALID_INVOKE_CHANNELS.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        return Promise.reject(new Error(`IPC channel "${channel}" is not allowed.`));
    },

    /**
     * Send a one-way message to main process.
     * Only whitelisted channels are allowed.
     */
    send: (channel, ...args) => {
        if (VALID_SEND_CHANNELS.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        }
    },

    /**
     * Listen for messages from main process.
     * Only whitelisted channels are allowed.
     * Returns an unsubscribe function.
     */
    on: (channel, callback) => {
        if (VALID_RECEIVE_CHANNELS.includes(channel)) {
            const handler = (_event, ...args) => callback(...args);
            ipcRenderer.on(channel, handler);
            return () => ipcRenderer.removeListener(channel, handler);
        }
        return () => {};
    }
});
