// Preload script for UM Chat Electron app
// This script runs in a sandboxed context before the web page loads

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electronAPI', {
  // Error page handlers
  errorPageRetry: () => ipcRenderer.send('error-page-retry'),
  errorPageQuit: () => ipcRenderer.send('error-page-quit')
});

window.addEventListener('DOMContentLoaded', () => {
  // Any initialization code can go here if needed
});
