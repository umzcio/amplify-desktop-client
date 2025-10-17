// Preload script for UM Chat Electron app
// This script runs in a sandboxed context before the web page loads

// Enable context isolation for security
// No custom APIs are exposed to the renderer process since we're just loading a web app

window.addEventListener('DOMContentLoaded', () => {
  // Any initialization code can go here if needed
  // Currently, the app just loads the web application without custom modifications
});
