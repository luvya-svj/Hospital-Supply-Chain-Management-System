const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ssDir = path.join(__dirname, '..', 'screenshots');
const deskDir = path.join(ssDir, 'desktop');
const tabDir = path.join(ssDir, 'tablet');
fs.mkdirSync(deskDir, { recursive: true });
fs.mkdirSync(tabDir, { recursive: true });

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function getDebuggerUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const pageTarget = list.find(t => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
    } catch (e) {
      // retry
    }
    await wait(300);
  }
  throw new Error('Could not connect to Chrome debugger endpoint');
}

async function run() {
  const tmpProfile = path.join(os.tmpdir(), 'chrome_ss_' + Date.now());
  const cdpPort = 9228;

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=${tmpProfile}`,
    'about:blank'
  ]);

  try {
    const wsUrl = await getDebuggerUrl(cdpPort);
    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log('Connected to Chrome CDP successfully');

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Network.enable');

    async function capture(pageName, width, height, dir) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 900
      });
      await wait(700); // allow charts/tables to render
      const ss = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(ss.data, 'base64');
      const filename = path.join(dir, `${pageName}.png`);
      fs.writeFileSync(filename, buf);
      console.log(`Saved screenshot: ${pageName} (${width}x${height})`);
    }

    async function loginAs(email, password) {
      await cdp.send('Network.clearBrowserCookies');
      await cdp.send('Page.navigate', { url: 'http://localhost:3000/login.html' });
      await wait(500);

      await cdp.send('Runtime.evaluate', {
        expression: `
          document.getElementById('email').value = '${email}';
          document.getElementById('password').value = '${password}';
          document.getElementById('btn-login-submit').click();
        `
      });
      await wait(1200);
    }

    // 1. Login Page
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/login.html' });
    await wait(600);
    await capture('login_desktop', 1280, 800, deskDir);
    await capture('login_tablet', 768, 1024, tabDir);

    const roles = [
      {
        role: 'admin',
        email: 'admin@hscms.test',
        pass: 'Admin@123',
        pages: ['dashboard', 'users', 'settings', 'alerts', 'reports']
      },
      {
        role: 'inventory',
        email: 'inventory@hscms.test',
        pass: 'Inventory@123',
        pages: ['dashboard', 'inventory', 'stock-monitoring', 'expiry-monitoring', 'disposal-management', 'manage-requests', 'alerts']
      },
      {
        role: 'procurement',
        email: 'procurement@hscms.test',
        pass: 'Procure@123',
        pages: ['dashboard', 'manage-suppliers', 'purchase-orders', 'alerts']
      },
      {
        role: 'staff',
        email: 'staff@hscms.test',
        pass: 'Staff@123',
        pages: ['dashboard', 'browse-supplies', 'request-supplies', 'my-requests']
      },
      {
        role: 'supplier',
        email: 'supplier@hscms.test',
        pass: 'Supplier@123',
        pages: ['dashboard', 'vendor-orders', 'vendor-deliveries']
      }
    ];

    for (const r of roles) {
      console.log(`\nLogging in as ${r.role} (${r.email})...`);
      await loginAs(r.email, r.pass);

      for (const p of r.pages) {
        await cdp.send('Page.navigate', { url: `http://localhost:3000/#${p}` });
        await wait(800);

        await capture(`${r.role}_${p}`, 1280, 850, deskDir);
        await capture(`${r.role}_${p}`, 768, 1024, tabDir);
      }
    }

    console.log('\nAll screenshots captured successfully!');
  } finally {
    chromeProcess.kill();
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

run().catch(err => {
  console.error('Screenshot run failed:', err);
  process.exit(1);
});
