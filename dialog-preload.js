// Secure preload script for dialog windows
// This script creates a safe bridge between the renderer and main process

const { contextBridge, ipcRenderer, shell } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  closeWindow: () => {
    ipcRenderer.send('dialog-close');
  },

  // External links (validated on main process side)
  openExternal: (url) => {
    // Basic validation in renderer
    if (typeof url !== 'string' || !url.startsWith('http')) {
      console.error('Invalid URL provided to openExternal');
      return;
    }
    shell.openExternal(url);
  },

  // Preferences dialog
  savePreferences: (data) => {
    ipcRenderer.send('preferences-save', data);
  },

  // Update dialog
  updateDialogResponse: (response) => {
    ipcRenderer.send('update-dialog-response', response);
  },

  // Get dialog data (for populating forms)
  getQueryParams: () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      version: urlParams.get('version') || '',
      environment: urlParams.get('environment') || '',
      prodUrl: urlParams.get('prodUrl') || '',
      devUrl: urlParams.get('devUrl') || '',
      devEnabled: urlParams.get('devEnabled') || '',
      type: urlParams.get('type') || '',
      updateVersion: urlParams.get('version') || ''
    };
  }
});

// Log that preload script loaded successfully
console.log('Dialog preload script loaded');
