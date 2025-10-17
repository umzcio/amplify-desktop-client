const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize electron-store for persisting settings
const store = new Store();

// Environment URLs
const ENVIRONMENTS = {
  production: 'https://chat.umontana.ai',
  development: 'https://dev-chat.umontana.ai'
};

let mainWindow;

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
  mainWindow.loadURL(ENVIRONMENTS[environment]);

  // Save window bounds on close
  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Handle new window requests (target="_blank" links) - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow authentication flows and keep everything else in the app
    // Only open truly external documentation/help links in browser
    const urlObj = new URL(url);

    // Common external domains that should open in browser
    const externalDomains = ['github.com', 'stackoverflow.com', 'google.com/search'];
    const shouldOpenExternal = externalDomains.some(domain => urlObj.hostname.includes(domain));

    if (shouldOpenExternal) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    // For everything else, allow it to open in the same window
    return { action: 'allow' };
  });

  // Allow all navigation within the window (needed for SAML/SSO authentication flows)
  // Authentication often redirects through multiple domains (Google, Microsoft, etc.)
  // and needs to navigate freely to complete the login process

  // Set up application menu
  createMenu();
}

function createMenu() {
  const environment = store.get('environment', 'production');

  const template = [
    // File menu
    {
      label: 'File',
      submenu: [
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
          submenu: [
            {
              label: 'Production (chat.umontana.ai)',
              type: 'radio',
              checked: environment === 'production',
              click: () => switchEnvironment('production')
            },
            {
              label: 'Development (dev-chat.umontana.ai)',
              type: 'radio',
              checked: environment === 'development',
              click: () => switchEnvironment('development')
            }
          ]
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
          label: 'About',
          click: () => {
            const currentEnv = store.get('environment', 'production');
            const version = app.getVersion();
            const aboutMessage = `Amplify\n\nVersion: ${version}\nEnvironment: ${currentEnv}\nURL: ${ENVIRONMENTS[currentEnv]}\n\nDesktop app for University of Montana chat applications.`;

            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Amplify',
              message: 'Amplify',
              detail: aboutMessage,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // On macOS, add app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        {
          label: `About ${app.name}`,
          click: () => {
            const currentEnv = store.get('environment', 'production');
            const version = app.getVersion();
            const aboutMessage = `Amplify\n\nVersion: ${version}\nEnvironment: ${currentEnv}\nURL: ${ENVIRONMENTS[currentEnv]}\n\nDesktop app for University of Montana chat applications.`;

            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Amplify',
              message: 'Amplify',
              detail: aboutMessage,
              buttons: ['OK']
            });
          }
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

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

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
