# Plan: Build Electron Desktop App for UM Chat

## Overview
Create a simple Electron wrapper for chat.umontana.ai and dev-chat.umontana.ai that:
- Loads the web apps in a native desktop window
- Persists SSO login sessions (cookies saved locally)
- Allows easy toggling between production and dev environments
- Works on macOS and Windows

## Project Structure
```
umontana-chat-app/
├── package.json          # Dependencies and build config
├── main.js              # Main Electron process
├── preload.js           # Preload script for security
├── assets/
│   ├── icon.png         # App icon (1024x1024)
│   ├── icon.icns        # macOS icon (generate from png)
│   └── icon.ico         # Windows icon (generate from png)
└── README.md
```

## Key Features to Implement

### 1. Environment Switching
- Add menu item: "Environment" with submenu:
  - "Production (chat.umontana.ai)" ✓
  - "Development (dev-chat.umontana.ai)"
- Store selected environment in electron-store
- Reload window when environment changes
- Show current environment in window title

### 2. Session Persistence
- Cookies automatically persist via Electron's session storage
- User stays logged in after closing/reopening app
- Each environment has separate session storage

### 3. Menu Bar
Include these menu items:
- **File**: Quit
- **Edit**: Cut, Copy, Paste, Select All
- **View**: Reload, Toggle DevTools, Environment switcher
- **Window**: Minimize, Close
- **Help**: About (show version & environment info)

### 4. Keyboard Shortcuts
- `Cmd/Ctrl+R`: Reload page
- `Cmd/Ctrl+Q`: Quit
- `Cmd/Ctrl+Shift+D`: Toggle DevTools
- `Cmd/Ctrl+E`: Open environment switcher

### 5. Window Settings
- Default size: 1200x800
- Minimum size: 800x600
- Remember window size/position on close
- Standard title bar (not frameless)

## Dependencies Needed
```json
{
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  },
  "dependencies": {
    "electron-store": "^8.1.0"
  }
}
```

## Build Configuration
Use electron-builder to create:
- **macOS**: DMG installer
- **Windows**: NSIS installer + portable exe

Package.json build section should include:
```json
{
  "build": {
    "appId": "edu.umontana.chat",
    "productName": "UM Chat",
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "assets/icon.icns",
      "target": ["dmg", "zip"]
    },
    "win": {
      "icon": "assets/icon.ico",
      "target": ["nsis", "portable"]
    }
  }
}
```

## Implementation Notes

### main.js key points:
- Create BrowserWindow with webPreferences for session persistence
- Load URL based on stored environment preference
- Set up application menu with environment switcher
- Use electron-store to persist:
  - Environment choice (production vs development)
  - Window bounds (size and position)
- Handle external links (open in default browser, not in app)
- Set partition for session storage to separate prod/dev cookies

### Environment URLs:
```javascript
const ENVIRONMENTS = {
  production: 'https://chat.umontana.ai',
  development: 'https://dev-chat.umontana.ai'
};
```

### Security:
- Enable `contextIsolation: true`
- Use preload script for any IPC communication
- Set `nodeIntegration: false`
- No custom protocol handlers needed (just loading HTTPS URLs)

### SAML SSO:
- Works automatically! Electron uses Chromium's cookie storage
- Cookies persist between app launches in `userData` directory
- User logs in once per environment, stays logged in
- Separate cookie jars for prod vs dev using session partitions

### Window State Management:
```javascript
// Store on close
mainWindow.on('close', () => {
  store.set('windowBounds', mainWindow.getBounds());
});

// Restore on open
const bounds = store.get('windowBounds');
if (bounds) {
  mainWindow.setBounds(bounds);
}
```

## Icon Creation
- Start with a 1024x1024 PNG logo (University of Montana branding)
- Use `electron-icon-builder` or online tools to generate .icns and .ico
- Or manually provide all three formats
- Tool recommendation: https://www.electron.build/icons

## Testing Plan
1. Build and run app with `npm start`
2. Login to production - close app - reopen (should still be logged in)
3. Switch to dev environment - should prompt for login
4. Login to dev - switch back to prod (should still be logged in to prod)
5. Test all keyboard shortcuts work
6. Test window resize/position memory persists
7. Test that external links open in default browser
8. Build installers and test installation flow

## Build Commands
```bash
# Initial setup
npm install

# Development
npm start              # Run in development mode

# Building
npm run build          # Build for current platform
npm run build:mac      # Build for macOS only
npm run build:win      # Build for Windows only
```

## Scripts to Add to package.json
```json
{
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --mac --win",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win"
  }
}
```

## Optional Enhancements (future)
- System tray icon with quick environment switch
- Notification support if the web app sends notifications
- Picture-in-picture mode (like ChatGPT)
- Global keyboard shortcut to show/hide app (Cmd+Shift+Space)
- Auto-update functionality using electron-updater
- "Always on top" toggle option
- Custom user agent string

## Estimated Complexity
- **Lines of Code**: ~220 lines total
  - main.js: ~150 lines
  - preload.js: ~20 lines
  - package.json: ~50 lines
- **Time to Implement**: 15-30 minutes with Claude Code
- **Difficulty**: Easy to Medium

## File Distribution
Once built, the app will be in the `dist/` folder:
- **macOS**: `UM Chat-1.0.0.dmg` and `UM Chat-1.0.0-mac.zip`
- **Windows**: `UM Chat Setup 1.0.0.exe` and `UM Chat 1.0.0.exe` (portable)

## Installation for End Users
- **macOS**: Download DMG, drag to Applications folder, open (may need to allow in Security & Privacy)
- **Windows**: Download installer, run setup, follow prompts (may need to allow in SmartScreen)

## Maintenance Notes
- Electron updates: Run `npm update electron` periodically
- No backend changes needed - this is purely a wrapper
- If URLs change, update ENVIRONMENTS object in main.js
- App will work as long as the web apps work

## Additional Resources
- Electron Documentation: https://www.electronjs.org/docs/latest
- Electron Builder: https://www.electron.build/
- Electron Store: https://github.com/sindresorhus/electron-store

---

## Quick Start for Claude Code

Copy this entire plan and tell Claude Code:

> "Please build an Electron desktop app following this plan. The app should wrap our University of Montana chat applications (chat.umontana.ai and dev-chat.umontana.ai) and allow easy switching between environments while persisting SAML SSO login sessions."

Claude Code should be able to build the complete app from this specification!
