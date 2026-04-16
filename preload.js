const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'playlist.json');

contextBridge.exposeInMainWorld('signage', {
  loadConfig: () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')),
});
