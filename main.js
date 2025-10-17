const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Store = require('electron-store');

// Initialize electron-store for persisting settings
const store = new Store();

// Set app name (for macOS menu and system)
app.setName('Amplify');

// Configure auto-updater
autoUpdater.autoDownload = false; // Always ask user before downloading
autoUpdater.autoInstallOnAppQuit = true; // Install when app quits

// Environment URLs - load from store with defaults
function getEnvironments() {
  return {
    production: store.get('prodUrl', 'https://chat.umontana.ai'),
    development: store.get('devUrl', 'https://dev-chat.umontana.ai')
  };
}

// Check if development environment is enabled
function isDevEnabled() {
  return store.get('devEnabled', true);
}

let mainWindow;
let aboutWindow;
let preferencesWindow;
let updateDialog;
let updateCheckInProgress = false;
let updateDialogCallback = null;

function createWindow() {
  // Get stored environment (default to production)
  const environment = store.get('environment', 'production');

  // Get stored window bounds or use defaults
  const bounds = store.get('windowBounds', {
    width: 1200,
    height: 800
  });

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Use session partition to separate prod/dev cookies
      partition: `persist:${environment}`
    },
    title: `Amplify - ${environment === 'production' ? 'Production' : 'Development'}`
  });

  // Load the appropriate URL
  const environments = getEnvironments();
  mainWindow.loadURL(environments[environment]);

  // Save window bounds on close
  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Handle new window requests (target="_blank" links) - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow authentication flows and keep everything else in the app
    // Only open truly external documentation/help links in browser
    const urlObj = new URL(url);

    // Helper function to check if hostname matches external domain
    function isExternalDomain(hostname) {
      const externalDomains = ['github.com', 'stackoverflow.com', 'google.com'];
      return externalDomains.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );
    }

    if (isExternalDomain(urlObj.hostname)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    // For everything else, allow it to open in the same window
    return { action: 'allow' };
  });

  // Allow all navigation within the window (needed for SAML/SSO authentication flows)
  // Authentication often redirects through multiple domains (Google, Microsoft, etc.)
  // and needs to navigate freely to complete the login process

  // Track error state to prevent showing error page during auth redirects
  let consecutiveErrors = 0;
  let lastErrorTime = 0;
  let isShowingErrorPage = false;

  // Handle page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Ignore sub-frame loads, only care about main frame
    if (!isMainFrame) {
      return;
    }

    // Ignore if already showing error page
    if (isShowingErrorPage) {
      return;
    }

    // Ignore cancellations (user-initiated or during redirects)
    // Error codes: -3 is ERR_ABORTED (normal during redirects), -10 is ERR_TIMED_OUT
    if (errorCode === -3) {
      return;
    }

    // Ignore certain error codes that are common during SAML flows
    const ignoredErrors = [
      -300, // ERR_INVALID_URL - can happen during redirects
    ];

    if (ignoredErrors.includes(errorCode)) {
      return;
    }

    // Track consecutive errors to avoid false positives during auth
    const now = Date.now();
    if (now - lastErrorTime > 5000) {
      // Reset counter if more than 5 seconds since last error
      consecutiveErrors = 0;
    }

    consecutiveErrors++;
    lastErrorTime = now;

    // Only show error page if we have multiple consecutive errors
    // or if it's a clear network failure
    const networkErrors = [-2, -7, -21, -100, -101, -102, -105, -106, -109];
    const isNetworkError = networkErrors.includes(errorCode);

    if (consecutiveErrors >= 2 || isNetworkError) {
      isShowingErrorPage = true;

      // Map common error descriptions to user-friendly messages
      let errorDesc = errorDescription;

      // Load the error page
      mainWindow.loadFile('renderer/error.html', {
        query: {
          errorCode: errorCode,
          errorDesc: errorDesc
        }
      });
    }
  });

  // Reset error state on successful navigation and check for HTTP error pages
  mainWindow.webContents.on('did-finish-load', async () => {
    // Skip check if we're already showing our custom error page
    const currentURL = mainWindow.webContents.getURL();
    if (currentURL.includes('error.html')) {
      return;
    }

    // Check if page is a 404 or other error page
    try {
      const isErrorPage = await mainWindow.webContents.executeJavaScript(`
        (function() {
          const title = document.title.toLowerCase();
          const body = document.body ? document.body.innerText.toLowerCase() : '';

          // Check for common error indicators
          const has404 = title.includes('404') || body.includes('404');
          const hasErrorTitle = title.includes('error') || title.includes('not found');
          const hasErrorContent = body.includes('page could not be found') ||
                                  body.includes('page not found') ||
                                  body.includes('404 not found');

          // Check if it's a minimal error page (very little content)
          const isMinimal = document.body && document.body.innerText.length < 200;

          return (has404 || (hasErrorTitle && hasErrorContent) || (has404 && isMinimal));
        })();
      `);

      if (isErrorPage) {
        isShowingErrorPage = true;
        mainWindow.loadFile('renderer/error.html', {
          query: {
            errorCode: '404',
            errorDesc: 'Page not found - please check your internet connection or verify the server is accessible'
          }
        });
        return;
      }
    } catch (err) {
      // Ignore JavaScript execution errors
      console.log('Error checking page content:', err);
    }

    // Reset error counters on successful load
    consecutiveErrors = 0;
    isShowingErrorPage = false;
  });

  // Set up application menu
  createMenu();
}

function createMenu() {
  const environment = store.get('environment', 'production');
  const environments = getEnvironments();
  const devEnabled = isDevEnabled();

  // Build environment submenu
  const environmentSubmenu = [
    {
      label: `Production (${environments.production})`,
      type: 'radio',
      checked: environment === 'production',
      click: () => switchEnvironment('production')
    }
  ];

  // Only add development option if enabled
  if (devEnabled) {
    environmentSubmenu.push({
      label: `Development (${environments.development})`,
      type: 'radio',
      checked: environment === 'development',
      click: () => switchEnvironment('development')
    });
  }

  const template = [
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Preferences...',
          accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
          click: () => showPreferencesWindow()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+R',
          click: () => mainWindow.reload()
        },
        {
          label: 'Toggle DevTools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+D' : 'Ctrl+Shift+D',
          click: () => mainWindow.webContents.toggleDevTools()
        },
        { type: 'separator' },
        {
          label: 'Environment',
          accelerator: process.platform === 'darwin' ? 'Cmd+E' : 'Ctrl+E',
          submenu: environmentSubmenu
        }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Amplify Help',
          click: () => shell.openExternal('https://umontana.ai/guidelines/amplify-help')
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates()
        }
      ]
    }
  ];

  // On macOS, add app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'Amplify',
      submenu: [
        {
          label: 'About Amplify',
          click: () => showAboutWindow()
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => showPreferencesWindow()
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates()
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function switchEnvironment(newEnvironment) {
  const currentEnvironment = store.get('environment', 'production');

  if (newEnvironment !== currentEnvironment) {
    // Save the new environment
    store.set('environment', newEnvironment);

    // Recreate the window with new environment
    if (mainWindow) {
      mainWindow.close();
    }
    createWindow();
  }
}

function showAboutWindow() {
  // If about window already exists, focus it
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }

  const currentEnv = store.get('environment', 'production');
  const version = app.getVersion();
  const environments = getEnvironments();
  const url = environments[currentEnv];

  // Create about window
  aboutWindow = new BrowserWindow({
    width: 600,
    height: 800,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    title: 'About Amplify',
    parent: mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the about page with query parameters
  aboutWindow.loadFile('renderer/about.html', {
    query: {
      version: version,
      environment: currentEnv,
      url: url
    }
  });

  // Remove menu bar on Windows/Linux
  aboutWindow.setMenuBarVisibility(false);

  // Clean up reference when window is closed
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

function showPreferencesWindow() {
  // If preferences window already exists, focus it
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.focus();
    return;
  }

  const environments = getEnvironments();
  const devEnabled = isDevEnabled();

  // Create preferences window
  preferencesWindow = new BrowserWindow({
    width: 650,
    height: 520,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    title: 'Preferences',
    parent: mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the preferences page with query parameters
  preferencesWindow.loadFile('renderer/preferences.html', {
    query: {
      prodUrl: environments.production,
      devUrl: environments.development,
      devEnabled: devEnabled.toString()
    }
  });

  // Remove menu bar on Windows/Linux
  preferencesWindow.setMenuBarVisibility(false);

  // Clean up reference when window is closed
  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });
}

// Function to show custom update dialog
function showUpdateDialog(type, version = null) {
  return new Promise((resolve) => {
    // Close existing dialog if open
    if (updateDialog && !updateDialog.isDestroyed()) {
      updateDialog.close();
    }

    updateDialogCallback = resolve;

    updateDialog = new BrowserWindow({
      width: 480,
      height: 320,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      title: 'Update',
      parent: mainWindow,
      modal: true,
      titleBarStyle: 'hidden',
      backgroundColor: '#3d3d3d',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    updateDialog.loadFile('renderer/update-dialog.html', {
      query: {
        type: type,
        version: version || ''
      }
    });

    updateDialog.on('closed', () => {
      updateDialog = null;
      if (updateDialogCallback) {
        updateDialogCallback('cancel');
        updateDialogCallback = null;
      }
    });
  });
}

// Handle dialog close requests from renderer
ipcMain.on('dialog-close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) {
    window.close();
  }
});

// Handle update dialog responses
ipcMain.on('update-dialog-response', (event, response) => {
  if (updateDialogCallback) {
    updateDialogCallback(response);
    updateDialogCallback = null;
  }
  if (updateDialog && !updateDialog.isDestroyed()) {
    updateDialog.close();
  }
});

// Handle preferences save
ipcMain.on('preferences-save', (event, settings) => {
  // Save the new URLs to store
  store.set('prodUrl', settings.prodUrl);
  store.set('devUrl', settings.devUrl);
  store.set('devEnabled', settings.devEnabled);

  // Close preferences window
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.close();
  }

  // Recreate the main window to apply new settings
  if (mainWindow) {
    mainWindow.close();
  }
  createWindow();
});

// Handle error page retry
ipcMain.on('error-page-retry', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const environment = store.get('environment', 'production');
    const environments = getEnvironments();
    mainWindow.loadURL(environments[environment]);
  }
});

// Handle error page quit
ipcMain.on('error-page-quit', () => {
  app.quit();
});

// Function to manually check for updates
async function checkForUpdates() {
  if (updateCheckInProgress) {
    return;
  }

  if (!app.isPackaged) {
    await showUpdateDialog('dev-mode');
    return;
  }

  updateCheckInProgress = true;
  autoUpdater.checkForUpdates();
}

// Auto-updater event handlers
autoUpdater.on('update-available', async (info) => {
  updateCheckInProgress = false;
  const response = await showUpdateDialog('available', info.version);

  if (response === 'primary') {
    // Start download silently - will show "ready" dialog when complete
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-not-available', async () => {
  if (updateCheckInProgress) {
    // User manually checked - show them a message
    await showUpdateDialog('up-to-date');
  }
  updateCheckInProgress = false;
});

autoUpdater.on('update-downloaded', async () => {
  const response = await showUpdateDialog('ready');

  if (response === 'primary') {
    autoUpdater.quitAndInstall();
  }
});

autoUpdater.on('error', async (error) => {
  console.error('Auto-updater error:', error);

  // Show error only if user manually checked
  if (updateCheckInProgress) {
    await showUpdateDialog('error');
  }

  updateCheckInProgress = false;
});

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  // Check for updates after app launches (skip in development)
  if (app.isPackaged) {
    // Wait 3 seconds after launch to check for updates
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  } else {
    console.log('Skipping auto-updater check in development mode');
  }

  app.on('activate', () => {
    // On macOS, recreate window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
