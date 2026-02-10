#!/usr/bin/env node
// Lyra v2 Installer — copies hooks and patches settings.json
// Usage: node install.js [--uninstall]

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const isWindows = process.platform === 'win32';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  [OK] ${msg}`); }
function warn(msg) { console.log(`  [!!] ${msg}`); }
function banner(msg) { console.log(`\n${'='.repeat(50)}\n  ${msg}\n${'='.repeat(50)}\n`); }

function copyHook(filename) {
  const src = path.join(__dirname, 'hooks', filename);
  const dest = path.join(HOOKS_DIR, filename);
  if (!fs.existsSync(src)) {
    warn(`Source not found: ${src}`);
    return false;
  }
  fs.copyFileSync(src, dest);
  ok(`Copied ${filename}`);
  return true;
}

function getNodePath() {
  if (isWindows) {
    const candidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
      process.execPath,
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
  }
  return 'node';
}

function getPowershellPath() {
  const candidates = [
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'powershell',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'powershell';
}

function buildLyraHooks() {
  const nodePath = getNodePath();
  const contextPath = path.join(HOOKS_DIR, 'lyra-context.js').replace(/\\/g, '/');
  const routerPath = path.join(HOOKS_DIR, 'lyra-router.js').replace(/\\/g, '/');

  const contextHook = {
    hooks: [{
      type: 'command',
      command: `${nodePath} "${contextPath}"`,
      timeout: 5,
    }],
  };

  const routerHook = {
    hooks: [{
      type: 'command',
      command: `${nodePath} "${routerPath}"`,
      timeout: 5,
    }],
  };

  let qualityGateHook;
  if (isWindows) {
    const ps = getPowershellPath();
    const gatePath = path.join(HOOKS_DIR, 'stop-quality-gate.ps1').replace(/\\/g, '/');
    qualityGateHook = {
      hooks: [{
        type: 'command',
        command: `${ps} -ExecutionPolicy Bypass -File "${gatePath}"`,
        timeout: 15,
      }],
    };
  } else {
    const gatePath = path.join(HOOKS_DIR, 'stop-quality-gate.sh').replace(/\\/g, '/');
    qualityGateHook = {
      hooks: [{
        type: 'command',
        command: `bash "${gatePath}"`,
        timeout: 15,
      }],
    };
  }

  return { contextHook, routerHook, qualityGateHook };
}

function hasLyraHook(hookArray) {
  if (!Array.isArray(hookArray)) return false;
  return hookArray.some(entry =>
    entry.hooks && entry.hooks.some(h =>
      (h.command && (h.command.includes('lyra-context') || h.command.includes('lyra-router'))) ||
      (h.prompt && h.prompt.includes('Lyra'))
    )
  );
}

function removeLyraHooks(hookArray) {
  if (!Array.isArray(hookArray)) return hookArray;
  return hookArray.filter(entry =>
    !(entry.hooks && entry.hooks.some(h =>
      (h.command && (h.command.includes('lyra-context') || h.command.includes('lyra-router'))) ||
      (h.prompt && h.prompt.includes('Lyra')) ||
      (h.command && h.command.includes('stop-quality-gate'))
    ))
  );
}

function install() {
  banner('Lyra v2 — Installing');

  // Ensure directories exist
  if (!fs.existsSync(CLAUDE_DIR)) {
    warn(`Claude Code directory not found at ${CLAUDE_DIR}`);
    warn('Make sure Claude Code is installed first.');
    process.exit(1);
  }

  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    ok('Created hooks directory');
  }

  // Copy hook files
  log('Copying hooks...');
  copyHook('lyra-context.js');
  copyHook('lyra-router.js');
  if (isWindows) {
    copyHook('stop-quality-gate.ps1');
  } else {
    copyHook('stop-quality-gate.sh');
    fs.chmodSync(path.join(HOOKS_DIR, 'stop-quality-gate.sh'), '755');
  }

  // Patch settings.json
  log('');
  log('Patching settings.json...');

  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    const backupPath = SETTINGS_PATH + '.lyra-backup';
    fs.copyFileSync(SETTINGS_PATH, backupPath);
    ok(`Backup saved to ${backupPath}`);
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch (e) {
      warn(`settings.json is corrupted: ${e.message}`);
      warn('Starting with empty settings. Your backup is safe.');
      settings = {};
    }
  }

  if (!settings.hooks) settings.hooks = {};

  const { contextHook, routerHook, qualityGateHook } = buildLyraHooks();

  // UserPromptSubmit — add context + router
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

  if (hasLyraHook(settings.hooks.UserPromptSubmit)) {
    settings.hooks.UserPromptSubmit = removeLyraHooks(settings.hooks.UserPromptSubmit);
    log('Removed existing Lyra hooks (upgrading)');
  }

  // Insert Lyra hooks at the beginning
  settings.hooks.UserPromptSubmit.unshift(routerHook);
  settings.hooks.UserPromptSubmit.unshift(contextHook);
  ok('Added Lyra context + router to UserPromptSubmit');

  // Stop — add quality gate
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  if (settings.hooks.Stop.some(e => e.hooks && e.hooks.some(h => h.command && h.command.includes('quality-gate')))) {
    settings.hooks.Stop = settings.hooks.Stop.filter(e =>
      !(e.hooks && e.hooks.some(h => h.command && h.command.includes('quality-gate')))
    );
    log('Removed existing quality gate (upgrading)');
  }

  settings.hooks.Stop.unshift(qualityGateHook);
  ok('Added quality gate to Stop');

  // Write settings
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  ok('Settings saved');

  banner('Lyra v2 — Installed!');
  log('Restart Claude Code to activate the new hooks.');
  log('');
  log('What Lyra does:');
  log('  - Injects project state and stack into every prompt');
  log('  - Routes prompts to the right workflow (GSD, agents, or direct)');
  log('  - Warns about console.log and uncommitted changes at session end');
  log('');
  log('When routing applies, Claude shows: Lyra -> /gsd:new-project');
  log('Most prompts get NO routing (by design — simple tasks stay simple).');
  log('');
}

function uninstall() {
  banner('Lyra v2 — Uninstalling');

  if (!fs.existsSync(SETTINGS_PATH)) {
    warn('No settings.json found. Nothing to uninstall.');
    process.exit(0);
  }

  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));

  if (settings.hooks) {
    if (settings.hooks.UserPromptSubmit) {
      settings.hooks.UserPromptSubmit = removeLyraHooks(settings.hooks.UserPromptSubmit);
      ok('Removed Lyra hooks from UserPromptSubmit');
    }
    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(e =>
        !(e.hooks && e.hooks.some(h => h.command && h.command.includes('quality-gate')))
      );
      ok('Removed quality gate from Stop');
    }
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  ok('Settings saved');

  // Remove hook files
  const files = ['lyra-context.js', 'lyra-router.js', 'stop-quality-gate.ps1', 'stop-quality-gate.sh'];
  for (const f of files) {
    const p = path.join(HOOKS_DIR, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      ok(`Deleted ${f}`);
    }
  }

  const backupPath = SETTINGS_PATH + '.lyra-backup';
  if (fs.existsSync(backupPath)) {
    log(`Backup available at ${backupPath} if you want to restore.`);
  }

  banner('Lyra v2 — Uninstalled');
  log('Restart Claude Code to apply changes.');
}

// Main
const args = process.argv.slice(2);
if (args.includes('--uninstall') || args.includes('-u')) {
  uninstall();
} else {
  install();
}
