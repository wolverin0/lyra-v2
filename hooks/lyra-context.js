#!/usr/bin/env node
// Lyra v2 Context Hook - Injects project state and stack detection
// Runs at UserPromptSubmit as a command hook
// Routing is handled separately by lyra-router.js

const fs = require('fs');
const path = require('path');

function main() {
  const cwd = process.cwd();
  const lines = [];

  // --- GSD PROJECT STATE ---
  // If the project uses GSD (.planning/ directory), inject current state
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (fs.existsSync(statePath)) {
    try {
      const content = fs.readFileSync(statePath, 'utf8');
      const first25 = content.split('\n').slice(0, 25).join('\n');
      lines.push('[GSD Project State]');
      lines.push(first25);
      lines.push('');
    } catch {}
  }

  // --- ACTIVE DEBUG SESSIONS ---
  // If GSD debug sessions exist, surface them
  const debugDir = path.join(cwd, '.planning', 'debug');
  if (fs.existsSync(debugDir)) {
    try {
      const sessions = fs.readdirSync(debugDir).filter(f => f.endsWith('.md'));
      if (sessions.length > 0) {
        lines.push(`[Active Debug Sessions: ${sessions.length}]`);
        sessions.slice(0, 3).forEach(s => lines.push(`  - ${s}`));
        lines.push('');
      }
    } catch {}
  }

  // --- STACK DETECTION ---
  // Detect project stack from package.json dependencies
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const stack = [];

      const checks = [
        // Frontend frameworks
        ['react', 'React'], ['next', 'Next.js'], ['vue', 'Vue'],
        ['svelte', 'Svelte'], ['angular', 'Angular'], ['solid-js', 'SolidJS'],
        ['astro', 'Astro'], ['remix', 'Remix'], ['nuxt', 'Nuxt'],
        // Mobile
        ['expo', 'Expo'], ['react-native', 'React Native'],
        // Backend frameworks
        ['express', 'Express'], ['fastify', 'Fastify'], ['hono', 'Hono'],
        ['@nestjs/core', 'NestJS'], ['koa', 'Koa'],
        // Databases & ORMs
        ['@supabase/supabase-js', 'Supabase'], ['firebase', 'Firebase'],
        ['prisma', 'Prisma'], ['@prisma/client', 'Prisma'],
        ['drizzle-orm', 'Drizzle'], ['mongoose', 'MongoDB'],
        ['pg', 'PostgreSQL'], ['mysql2', 'MySQL'], ['redis', 'Redis'],
        // API
        ['graphql', 'GraphQL'], ['@trpc/server', 'tRPC'], ['trpc', 'tRPC'],
        // State & data fetching
        ['@tanstack/react-query', 'TanStack Query'], ['zustand', 'Zustand'],
        // Styling
        ['tailwindcss', 'Tailwind'],
        // Testing
        ['vitest', 'Vitest'], ['jest', 'Jest'], ['@playwright/test', 'Playwright'],
        // Language
        ['typescript', 'TypeScript'],
        // Realtime
        ['socket.io', 'Socket.IO'], ['ws', 'WebSocket'],
        // 3D / Game
        ['three', 'Three.js'], ['@dimforge/rapier3d-compat', 'Rapier3D'],
        ['babylonjs', 'Babylon.js'], ['phaser', 'Phaser'],
        // AI
        ['@anthropic-ai/sdk', 'Anthropic SDK'], ['openai', 'OpenAI SDK'],
        ['@google/generative-ai', 'Gemini AI'],
      ];

      for (const [dep, label] of checks) {
        if (deps[dep]) stack.push(label);
      }

      // Deduplicate (e.g. prisma + @prisma/client)
      const unique = [...new Set(stack)];
      if (unique.length > 0) {
        lines.push(`[Stack: ${unique.join(', ')}]`);
      }
    } catch {}
  }

  // Detect Python project
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    lines.push('[Stack: Python]');
  }

  // Detect Go project
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    lines.push('[Stack: Go]');
  }

  // Detect Rust project
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    lines.push('[Stack: Rust]');
  }

  // Detect Java/Kotlin project
  if (fs.existsSync(path.join(cwd, 'pom.xml')) || fs.existsSync(path.join(cwd, 'build.gradle'))) {
    lines.push('[Stack: Java/Kotlin]');
  }

  if (lines.length > 0) {
    process.stdout.write(lines.join('\n'));
  }
}

main();
