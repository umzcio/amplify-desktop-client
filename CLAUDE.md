# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amplify is an Electron desktop wrapper for University of Montana chat applications (chat.umontana.ai and dev-chat.umontana.ai). The app provides persistent SAML SSO login sessions with environment switching capabilities.

## Development Commands

### Running the Application
```bash
npm start                 # Run in development mode
```

### Building for Distribution
```bash
npm run build             # Build for both macOS and Windows
npm run build:mac         # Build for macOS only (DMG and ZIP)
npm run build:win         # Build for Windows only (NSIS installer and portable EXE)
```

Build artifacts are generated in the `dist/` directory.

## Architecture

### Main Process (main.js)
The Electron main process handles:
- **Window Management**: Creates BrowserWindow with persistent bounds (size/position) stored via electron-store
- **Environment Switching**: Toggles between production (`https://chat.umontana.ai`) and development (`https://dev-chat.umontana.ai`) URLs
- **Session Persistence**: Uses session partitions (`persist:${environment}`) to maintain separate cookie storage for each environment, enabling persistent SAML SSO login
- **Menu System**: Application menu with environment switcher, keyboard shortcuts, and standard edit/view/window controls
- **External Link Handling**: Opens certain external domains (GitHub, Stack Overflow, Google) in default browser while keeping authentication flows in-app

### Preload Script (preload.js)
Minimal preload script with context isolation enabled. Currently does not expose custom APIs to the renderer process.

### State Persistence
Uses `electron-store` to persist:
- `environment`: Current environment selection (production/development)
- `windowBounds`: Window position and dimensions

Data is stored in OS-specific locations:
- macOS: `~/Library/Application Support/umontana-chat-app`
- Windows: `%APPDATA%/umontana-chat-app`

### Security Configuration
- `contextIsolation: true` - Preload scripts run in isolated context
- `nodeIntegration: false` - Renderer process cannot access Node.js APIs
- Session partitions separate production and development cookies
- External navigation allowed for SAML/SSO authentication flows (redirects through Google, Microsoft, etc.)

### Environment Switching Implementation
When switching environments (main.js:208):
1. New environment preference is saved to electron-store
2. Current window is closed
3. New window is created with different session partition
4. URL for new environment is loaded
5. Separate cookie storage ensures independent login sessions

### Window Open Handling
The app uses `setWindowOpenHandler` (main.js:53) to manage new window requests:
- External domains (GitHub, Stack Overflow, Google search) open in system browser
- All other links (including authentication flows) open within the app window
- This ensures SAML authentication works correctly while preventing the app from becoming a general web browser

### Application Menu
Key keyboard shortcuts:
- `Cmd/Ctrl+R` - Reload page
- `Cmd/Ctrl+Q` - Quit application
- `Cmd/Ctrl+Shift+D` - Toggle Developer Tools
- `Cmd/Ctrl+E` - Open environment switcher menu

### Build Configuration
electron-builder is configured in package.json with:
- App ID: `com.umontana.amplify`
- Product Name: `Amplify`
- macOS: DMG and ZIP targets with icon.icns
- Windows: NSIS installer and portable targets with icon.ico

## Working with This Codebase

### Modifying Environments
To add/modify environments, update the `ENVIRONMENTS` object in main.js:9 and the menu template in main.js:120.

### Changing Security Policies
When modifying `setWindowOpenHandler` or navigation handling, be careful to maintain SAML/SSO authentication flow functionality. Authentication often requires navigation through multiple external domains.

### Testing Environment Switching
1. Login to production environment
2. Close and reopen app - verify still logged in
3. Switch to development environment - should prompt for new login
4. Switch back to production - verify original session persists

### Icon Updates
Icons are located in `assets/`:
- `icon.png` - Base 1024x1024 image
- `icon.icns` - macOS icon (generated from PNG)
- `icon.ico` - Windows icon (generated from PNG)

Use `npx electron-icon-builder` or similar tools to regenerate platform-specific icons from the base PNG.
