/**
 * Build script for Factory ERP Desktop App
 * 
 * This script:
 * 1. Builds the NestJS backend
 * 2. Copies the compiled backend + node_modules + prisma into the desktop directory
 * 3. Then electron-builder packages everything into a Windows installer
 * 
 * Usage: node build.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const DESKTOP = __dirname;

function run(cmd, cwd = ROOT) {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ Source not found: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function convertSchemaToSqlite(srcFile, destFile) {
  let content = fs.readFileSync(srcFile, 'utf8');

  // 1. Extract all enum names
  const enumNames = [];
  const enumRegex = /enum\s+([A-Za-z0-9_]+)\s*\{/g;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    enumNames.push(match[1]);
  }

  // 2. Delete all enum declarations
  content = content.replace(/enum\s+[A-Za-z0-9_]+\s*\{[^}]*\}/g, '');

  // 3. Replace database provider to sqlite
  content = content.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');

  // 4. Remove PostgreSQL specific decorators (@db.Decimal, @db.Date, @db.VarChar, etc.)
  content = content.replace(/@db\.[A-Za-z0-9_]+(?:\([^)]*\))?/g, '');

  // 5. Replace Json types with String
  content = content.replace(/\bJson\b/g, 'String');

  // 6. Replace enum fields with String
  for (const enumName of enumNames) {
    const typeRegex = new RegExp(`(\\:\\s*|\\s+)${enumName}(\\s+|\\?|\\[)`, 'g');
    content = content.replace(typeRegex, `$1String$2`);
  }

  // 7. Convert unquoted default words (like default(ACTIVE)) to string literals default("ACTIVE")
  // Excludes booleans (true, false) and numbers
  content = content.replace(/@default\(((?!true|false|\d+)[A-Za-z0-9_]+)\)/g, '@default("$1")');

  fs.writeFileSync(destFile, content, 'utf8');
}

console.log('═══════════════════════════════════════════════');
console.log('  Nexora Enterprise — Desktop Build');
console.log('═══════════════════════════════════════════════');

// Step 1: Build the backend
console.log('\n📦 Step 1/4: Building NestJS backend...');
run('npm run build', BACKEND);

// Backup postgres schema and convert to sqlite before generation
const schemaPath = path.join(BACKEND, 'prisma', 'schema.prisma');
const schemaBackupPath = path.join(BACKEND, 'prisma', 'schema.prisma.bak');
console.log('\n📦 Temporary converting Prisma schema to SQLite for desktop client...');
fs.copyFileSync(schemaPath, schemaBackupPath);
convertSchemaToSqlite(schemaBackupPath, schemaPath);

// Step 2: Generate Prisma client
console.log('\n📦 Step 2/4: Generating Prisma client (SQLite)...');
try {
  run('npx prisma generate', BACKEND);
} finally {
  console.log('  → Restoring PostgreSQL schema...');
  fs.copyFileSync(schemaBackupPath, schemaPath);
  fs.unlinkSync(schemaBackupPath);
}

// Step 3: Copy backend files to desktop
console.log('\n📦 Step 3/4: Copying backend files...');

// Clean old copies
cleanDir(path.join(DESKTOP, 'backend-dist'));
cleanDir(path.join(DESKTOP, 'backend-node_modules'));
cleanDir(path.join(DESKTOP, 'backend-prisma'));

// Copy compiled backend
console.log('  → Copying dist/...');
copyDir(path.join(BACKEND, 'dist'), path.join(DESKTOP, 'backend-dist'));

// Copy converted prisma schema for runtime push/usage
console.log('  → Copying SQLite prisma schema...');
const desktopPrismaDest = path.join(DESKTOP, 'backend-prisma');
fs.mkdirSync(desktopPrismaDest, { recursive: true });
convertSchemaToSqlite(schemaPath, path.join(desktopPrismaDest, 'schema.prisma'));
// Compile and copy seed script
console.log('  → Compiling seed script...');
try {
  run('npx tsc prisma/seed.ts --target es2022 --module commonjs --moduleResolution node --skipLibCheck', BACKEND);
  const seedJsSrc = path.join(BACKEND, 'prisma', 'seed.js');
  const seedJsDest = path.join(desktopPrismaDest, 'seed.js');
  if (fs.existsSync(seedJsSrc)) {
    fs.copyFileSync(seedJsSrc, seedJsDest);
    fs.unlinkSync(seedJsSrc); // clean up temporary JS file
    console.log('  ✓ Seed script compiled and copied successfully.');
  }
} catch (e) {
  console.warn('  ⚠ Failed to compile seed.ts', e);
}

// Copy node_modules (only production deps + prisma)
console.log('  → Copying node_modules (this may take a moment)...');
const nodeModulesDest = path.join(DESKTOP, 'backend-node_modules');
fs.mkdirSync(nodeModulesDest, { recursive: true });

const backendNodeModules = path.join(BACKEND, 'node_modules');
const backendPkg = require(path.join(BACKEND, 'package.json'));

// Dev dependencies to exclude (except prisma which we need for runtime push)
const devDepsToExclude = new Set(
  Object.keys(backendPkg.devDependencies || {})
    .filter(dep => dep !== 'prisma')
);

// Add typings and other purely dev folders to exclude
devDepsToExclude.add('@types');
devDepsToExclude.add('.bin'); // NPM executables

if (fs.existsSync(backendNodeModules)) {
  const modules = fs.readdirSync(backendNodeModules);
  for (const mod of modules) {
    if (devDepsToExclude.has(mod)) {
      console.log(`  → Skipping devDependency: ${mod}`);
      continue;
    }

    const src = path.join(backendNodeModules, mod);
    const dest = path.join(nodeModulesDest, mod);

    if (fs.statSync(src).isDirectory()) {
      if (mod.startsWith('@')) {
        // Handle scoped packages
        if (!fs.existsSync(src)) continue;
        const submodules = fs.readdirSync(src);
        for (const submod of submodules) {
          const fullModName = `${mod}/${submod}`;
          if (devDepsToExclude.has(fullModName)) {
            console.log(`  → Skipping devDependency: ${fullModName}`);
            continue;
          }
          const subSrc = path.join(src, submod);
          const subDest = path.join(dest, submod);
          fs.mkdirSync(dest, { recursive: true });
          if (fs.statSync(subSrc).isDirectory()) {
            copyDir(subSrc, subDest);
          } else {
            fs.copyFileSync(subSrc, subDest);
          }
        }
      } else {
        copyDir(src, dest);
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// Copy SQLite prisma client to frontend-standalone to ensure Next.js uses the SQLite client
console.log('  → Copying SQLite Prisma client to frontend-standalone/node_modules...');
const frontendNodeModules = path.join(DESKTOP, 'frontend-standalone', 'node_modules');
if (fs.existsSync(frontendNodeModules)) {
  const prismaDest = path.join(frontendNodeModules, '@prisma');
  const dotPrismaDest = path.join(frontendNodeModules, '.prisma');
  const prismaCliDest = path.join(frontendNodeModules, 'prisma');

  // Clean old ones
  cleanDir(prismaDest);
  cleanDir(dotPrismaDest);
  cleanDir(prismaCliDest);

  copyDir(path.join(nodeModulesDest, '@prisma'), prismaDest);
  copyDir(path.join(nodeModulesDest, '.prisma'), dotPrismaDest);
  if (fs.existsSync(path.join(nodeModulesDest, 'prisma'))) {
    copyDir(path.join(nodeModulesDest, 'prisma'), prismaCliDest);
  }
}

// Copy .env.example as .env.defaults
const envExample = path.join(BACKEND, '.env.example');
const envDefaults = path.join(DESKTOP, '.env.defaults');
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envDefaults);
}

// Step 4: Summary
console.log('\n═══════════════════════════════════════════════');
console.log('  ✅ Build preparation complete!');
console.log('');
console.log('  Next steps:');
console.log('  1. cd desktop');
console.log('  2. npm install');
console.log('  3. npm run dist');
console.log('');
console.log('  This will create the installer in desktop/release/');
console.log('═══════════════════════════════════════════════');
