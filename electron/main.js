const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

let mainWindow;
let serverProcess;

const baseAppPath = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
const serverFile = path.join(baseAppPath, 'server.ts');

function checkServerReady(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    (function poll() {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          if (Date.now() - start > timeoutMs) {
            reject(new Error('Server readiness timeout'));
          } else {
            setTimeout(poll, 200);
          }
        }
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Server readiness timeout'));
        } else {
          setTimeout(poll, 200);
        }
      });
    })();
  });
}

function startBackend() {
  const tsxCmd = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
  const tsxPath = path.join(baseAppPath, 'node_modules', '.bin', tsxCmd);

  serverProcess = spawn(tsxPath, [serverFile], {
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT,
      APP_ROOT: baseAppPath
    },
    stdio: 'inherit',
  });

  serverProcess.on('exit', (code) => {
    console.log('Backend exited with code', code);
  });

  serverProcess.on('error', (err) => {
    console.error('Backend failed to start', err);
    dialog.showErrorBox('Backend launch failed', String(err));
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 820,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const url = `http://127.0.0.1:${PORT}`;

  try {
    await checkServerReady(`${url}/api/health`);
    mainWindow.loadURL(url);
    mainWindow.once('ready-to-show', () => mainWindow.show());
  } catch (err) {
    dialog.showErrorBox('Error', 'Could not start backend server in time. ' + err.message);
    console.error(err);
    app.quit();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});