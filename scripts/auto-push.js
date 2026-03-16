const path = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');

const ROOT = process.cwd();
const WATCH_PATHS = [
  'admin',
  'employee',
  'server',
  'data',
  'index.js',
  'render.yaml',
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  'docker-compose.yml',
  '.env.example',
  'README.md'
];

const IGNORED = [
  /\.git([\\/]|$)/,
  /node_modules([\\/]|$)/,
  /\\\.env$/,
  /\/\.env$/,
  /data[\\/]db\.json$/
];

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
}

function getBranch() {
  try {
    return run('git rev-parse --abbrev-ref HEAD');
  } catch {
    return 'main';
  }
}

function hasChanges() {
  try {
    return run('git status --porcelain') !== '';
  } catch {
    return false;
  }
}

function autoCommitAndPush() {
  if (!hasChanges()) return;

  const branch = getBranch();
  const remote = process.env.AUTO_PUSH_REMOTE || 'origin';
  const timestamp = new Date().toISOString();

  try {
    execSync('git add -A', { stdio: 'inherit' });
    execSync(`git commit -m "Auto sync ${timestamp}"`, { stdio: 'inherit' });
    execSync(`git push ${remote} ${branch}`, { stdio: 'inherit' });
    console.log(`[auto-push] Pushed to ${remote}/${branch} at ${timestamp}`);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error(`[auto-push] Failed: ${message}`);
  }
}

let timer = null;
function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    autoCommitAndPush();
  }, 2000);
}

console.log('[auto-push] Watching for changes...');
const watcher = chokidar.watch(WATCH_PATHS, {
  cwd: ROOT,
  ignored: IGNORED,
  ignoreInitial: true,
  persistent: true
});

watcher.on('all', schedule);
