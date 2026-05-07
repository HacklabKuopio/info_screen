const { app, BrowserWindow, screen, session } = require('electron');
const fs = require('fs');
const path = require('path');

// Allow autoplay without user gesture in all webviews
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Do not use the OS's secure encrypted keystore
app.commandLine.appendSwitch('password-store', 'basic');

const SIGNAGE_PARTITION = 'persist:signage';
const SHOULD_OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === 'true';

function loadEnvFile(filePath, loadedKeys, initialEnvKeys) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) return;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (!key || initialEnvKeys.has(key)) return;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (loadedKeys.has(key) || process.env[key] === undefined) {
      process.env[key] = value;
      loadedKeys.add(key);
    }
  });
}

function loadEnvironment() {
  const initialEnvKeys = new Set(Object.keys(process.env));
  const loadedKeys = new Set();
  loadEnvFile(path.join(__dirname, '.env'), loadedKeys, initialEnvKeys);
  loadEnvFile(path.join(__dirname, '.env.local'), loadedKeys, initialEnvKeys);
}

function isConsentPage(urlString) {
  try {
    const { hostname } = new URL(urlString);
    return hostname === 'consent.youtube.com' || hostname === 'consent.google.com';
  } catch (_) {
    return false;
  }
}

async function seedConsentCookies(targetSession) {
  const oneYearFromNow = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const cookieWrites = [
    {
      url: 'https://www.youtube.com',
      name: 'CONSENT',
      value: 'YES+cb.20220419-17-p0.en+FX+917',
      domain: '.youtube.com',
      path: '/',
      secure: true,
      expirationDate: oneYearFromNow
    },
    {
      url: 'https://www.google.com',
      name: 'CONSENT',
      value: 'YES+cb.20220419-17-p0.en+FX+917',
      domain: '.google.com',
      path: '/',
      secure: true,
      expirationDate: oneYearFromNow
    }
  ];

  await Promise.all(cookieWrites.map((cookie) => targetSession.cookies.set(cookie).catch(() => null)));
}

function registerWebviewGuards() {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return;

    contents.on('will-redirect', (event, url) => {
      if (isConsentPage(url)) event.preventDefault();
    });

    contents.on('will-navigate', (event, url) => {
      if (isConsentPage(url)) event.preventDefault();
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  win.setMenuBarVisibility(false);
  win.webContents.on('before-input-event', (event, input) => {
    const isDevToolsShortcut =
        input.key === 'F12' ||
        (input.control && input.shift && input.key.toLowerCase() === 'i');

    if (isDevToolsShortcut) {
      event.preventDefault();
      win.webContents.toggleDevTools();
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile('index.html');

  if (SHOULD_OPEN_DEVTOOLS) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.openDevTools({ mode: 'detach' });
    });
  }
}

app.whenReady().then(async () => {
  loadEnvironment();
  const signageSession = session.fromPartition(SIGNAGE_PARTITION);
  await seedConsentCookies(signageSession);
  registerWebviewGuards();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
