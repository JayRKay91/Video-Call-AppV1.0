const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      // These two lines fix the "require is not defined" error in your renderer.js
      nodeIntegration: true, 
      contextIsolation: false 
    },
  });

  win.loadFile('index.html');
  
  // Optional: Uncomment this to see the console errors while debugging
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  // 1. Setup permissions for camera and microphone access
  // Electron groups webcam, mic, and screen recording under the 'media' permission
  
  // Synchronous permission check
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true; //
    return true; 
  });

  // Asynchronous permission request handler
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true); // Approves media access
    callback(true);
  });

  // 2. Launch the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});