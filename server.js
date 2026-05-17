const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const pty = require('node-pty');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3456;
const SHELL = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
const AUTO_CMD = process.env.AUTO_CMD !== undefined ? process.env.AUTO_CMD : 'claude';
// Set AUTO_CMD="" to disable auto-launch and get a plain shell

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e6,
});

app.use(express.static(path.join(__dirname, 'public')));

// Patterns for virtual adapters to exclude from display
const VIRTUAL_PATTERNS = [
  /vmware/i, /virtualbox/i, /hyper-v/i, /wsl/i, /docker/i,
  /bluetooth/i, /vethernet/i, /ve?thernet/i, /loopback/i,
  /pseudo/i, /tunnel/i, /teredo/i, /isatap/i,
];

function isVirtualAdapter(name) {
  return VIRTUAL_PATTERNS.some(p => p.test(name));
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    if (isVirtualAdapter(name)) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

app.get('/api/info', async (req, res) => {
  const ips = getLocalIPs();
  const urls = ips.map(ip => `http://${ip}:${PORT}`);
  const qrData = urls[0] || `http://localhost:${PORT}`;
  try {
    const qrSvg = await QRCode.toString(qrData, { type: 'svg', width: 256 });
    res.json({ ips, port: PORT, urls, qrSvg });
  } catch {
    res.json({ ips, port: PORT, urls, qrSvg: null });
  }
});

// ── Persistent session ──
// PTY survives client disconnects so reconnecting resumes the same shell.
let session = null; // { pty, clients: Set<socket>, buffer: string[] }

const MAX_BUFFER = 2000;

function createPTY() {
  const shellCmd = SHELL;
  const shellArgs = process.platform === 'win32'
    ? ['-ExecutionPolicy', 'Bypass', '-NoLogo', '-NoExit']
    : [];

  const ptyProcess = pty.spawn(shellCmd, shellArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    handleFlowControl: false,
  });

  console.log(`[+] PTY spawned (pid: ${ptyProcess.pid})`);

  if (AUTO_CMD) {
    setTimeout(() => {
      try { ptyProcess.write(AUTO_CMD + '\r'); } catch {}
    }, 1000);
  }

  const clients = new Set();
  const buffer = [];
  const self = { pty: ptyProcess, clients, buffer };

  ptyProcess.onData((data) => {
    buffer.push(data);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    self.clients.forEach(s => { try { s.emit('terminal-output', data); } catch {} });
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[-] PTY exited: code=${exitCode}`);
    const msg = '\r\n\x1b[33mShell exited (code ' + exitCode + '). 点击「重新连接」重启会话。\x1b[0m\r\n';
    self.clients.forEach(s => { try { s.emit('terminal-output', msg); } catch {} });
    if (session === self) session = null;
  });

  return self;
}

function getSession() {
  if (!session) {
    session = createPTY();
  }
  return session;
}

io.on('connection', (socket) => {
  console.log(`[+] Client connected: ${socket.id}`);

  const sess = getSession();
  sess.clients.add(socket);

  // Replay buffer so reconnecting client sees prior output
  if (sess.buffer.length > 0) {
    const recent = sess.buffer.slice(-200);
    recent.forEach(d => socket.emit('terminal-output', d));
  }

  socket.emit('session-ready', { reconnected: sess.buffer.length > 0 });

  socket.on('terminal-input', (data) => {
    const s = session; // use current session (survives reset)
    if (s) { try { s.pty.write(data); } catch {} }
  });

  socket.on('terminal-resize', ({ cols, rows }) => {
    const s = session;
    if (s) { try { s.pty.resize(cols, rows); } catch {} }
  });

  socket.on('reset-session', () => {
    const old = sess;
    try { old.pty.kill(); } catch {}
    const fresh = createPTY();
    // Move all existing clients to new session
    old.clients.forEach(c => fresh.clients.add(c));
    old.clients.clear();
    socket.emit('terminal-output', '\r\n\x1b[36mSession reset.\x1b[0m\r\n');
  });

  socket.on('disconnect', () => {
    console.log(`[-] Client disconnected: ${socket.id}`);
    sess.clients.delete(socket);
  });

  socket.on('error', () => {
    sess.clients.delete(socket);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('Error: Port ' + PORT + ' is already in use.');
    console.error('Run: netstat -ano | findstr ' + PORT + '  to find the process, then');
    console.error('     taskkill /PID <pid> /F  to kill it.');
    console.error('');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('══ Remote Claude Code ══');
  console.log('');
  console.log('  Phone URL:  http://' + (ips[0] || 'localhost') + ':' + PORT);
  if (ips.length > 1) {
    ips.slice(1).forEach(ip => console.log('  (alt)       http://' + ip + ':' + PORT));
  }
  if (AUTO_CMD) {
    console.log('');
    console.log('  Claude Code auto-launches on first connection.');
    console.log('  Reconnecting resumes the same session.');
  }
  console.log('');
  console.log('══ Ctrl+C to stop ══');
  console.log('');
});
