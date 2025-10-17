# Icons Needed

To complete the build process, you'll need to add the following icon files to this directory:

## Required Icon Files:

1. **icon.png** - Base icon (1024x1024 pixels)
   - High resolution PNG of the University of Montana logo or chat app icon

2. **icon.icns** - macOS icon
   - Can be generated from icon.png using tools like:
     - https://cloudconvert.com/png-to-icns
     - https://www.electron.build/icons
     - `npx electron-icon-builder --input=./icon.png --output=./assets`

3. **icon.ico** - Windows icon
   - Can be generated from icon.png using tools like:
     - https://cloudconvert.com/png-to-ico
     - https://www.electron.build/icons
     - `npx electron-icon-builder --input=./icon.png --output=./assets`

## How to Generate Icons:

### Option 1: Online Tools
1. Create a 1024x1024 PNG with your desired icon
2. Visit https://cloudconvert.com/png-to-icns to create .icns file
3. Visit https://cloudconvert.com/png-to-ico to create .ico file
4. Place all three files in this directory

### Option 2: Using electron-icon-builder
```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./icon.png --output=./assets
```

## Note:
The app will build without icons, but the application won't have a custom icon in the dock/taskbar or in the installer. For production use, icons are highly recommended!
