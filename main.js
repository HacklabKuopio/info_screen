const { app, BrowserWindow, screen, session } = require('electron');

// Allow autoplay without user gesture in all webviews
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const SIGNAGE_PARTITION = 'persist:signage';

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
  const { bounds } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => {
    // Re-apply fullscreen mode after renderer is ready to avoid startup race conditions.
    win.setKiosk(true);
    win.setFullScreen(true);
    win.maximize();
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(async () => {
  const signageSession = session.fromPartition(SIGNAGE_PARTITION);
  await seedConsentCookies(signageSession);
  registerWebviewGuards();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
