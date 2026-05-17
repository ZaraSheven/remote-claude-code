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
  pingInterval: 10000,
  pingTimeout: 30000,
  connectTimeout: 10000,
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
let session = null; // { pty, clients, buffer, firstConnect }

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

  const clients = new Set();
  const buffer = [];
  const self = { pty: ptyProcess, clients, buffer, firstConnect: true };

  let autoCmdSent = false;

  ptyProcess.onData((data) => {
    buffer.push(data);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    self.clients.forEach(s => { try { s.emit('terminal-output', data); } catch {} });

    // Auto-launch on first data (shell is ready)
    if (AUTO_CMD && !autoCmdSent) {
      autoCmdSent = true;
      // Small delay after first data to ensure shell is fully initialized
      setTimeout(() => {
        try { self.pty.write(AUTO_CMD + '\r'); } catch {}
      }, 500);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[-] PTY exited: code=${exitCode}`);
    const msg = '\r\n\x1b[33mShell exited (code ' + exitCode + '). Click reconnect to restart session.\x1b[0m\r\n';
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

function ts() {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

// ── Socket.IO ──
io.on('connection', (socket) => {
  console.log(`[${ts()}] + ${socket.id} (total: ${io.engine.clientsCount})`);

  const sess = getSession();
  const isNew = sess.firstConnect;
  if (isNew) sess.firstConnect = false;

  sess.clients.add(socket);

  // Replay buffer for reconnecting clients
  if (!isNew && sess.buffer.length > 0) {
    const recent = sess.buffer.slice(-200);
    recent.forEach(d => socket.emit('terminal-output', d));
  }

  socket.emit('session-ready', { reconnected: !isNew });

  socket.on('terminal-input', (data) => {
    const s = session;
    if (s) { try { s.pty.write(data); } catch {} }
  });

  socket.on('terminal-resize', ({ cols, rows }) => {
    const s = session;
    if (s) { try { s.pty.resize(cols, rows); } catch {} }
  });

  socket.on('reset-session', () => {
    console.log(`[${ts()}] * reset by ${socket.id}`);
    const old = session;
    if (!old) {
      // No session to reset, create fresh
      const fresh = createPTY();
      fresh.clients.add(socket);
      socket.emit('terminal-output', '\r\n\x1b[36mNew session started.\x1b[0m\r\n');
      return;
    }
    try { old.pty.kill(); } catch {}
    const fresh = createPTY();
    // Migrate all active clients to the new session
    old.clients.forEach(c => {
      try { fresh.clients.add(c); } catch {}
    });
    old.clients.clear();
    // Notify all clients
    fresh.clients.forEach(c => {
      try { c.emit('terminal-output', '\r\n\x1b[36mSession reset.\x1b[0m\r\n'); } catch {}
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[${ts()}] - ${socket.id} ${reason} (total: ${io.engine.clientsCount - 1})`);
    sess.clients.delete(socket);
  });

  socket.on('error', (err) => {
    console.log(`[${ts()}] ! ${socket.id} ${err.message || err}`);
    sess.clients.delete(socket);
  });
});

// ── Graceful shutdown ──
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (session) { try { session.pty.kill(); } catch {} }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (session) { try { session.pty.kill(); } catch {} }
  process.exit(0);
});

// ── Server errors ──
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
  if (ips.length > 0) {
    console.log('  Phone URL:  http://' + ips[0] + ':' + PORT);
    ips.slice(1).forEach(ip => console.log('  (alt)       http://' + ip + ':' + PORT));
  } else {
    console.log('  No network IP found. Check your connection.');
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
