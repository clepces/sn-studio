import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function assembleSpaHtml(): string {
  const layoutsDir = path.join(rootDir, 'src/frontend/templates/layouts');
  const viewsDir = path.join(rootDir, 'src/frontend/templates/views');

  const appShellFile = path.join(layoutsDir, 'app-shell.template.html');
  const dockFile = path.join(layoutsDir, 'dock.template.html');
  const sidebarFile = path.join(layoutsDir, 'sidebar.template.html');
  const headerFile = path.join(layoutsDir, 'header.template.html');
  const modalFile = path.join(layoutsDir, 'modal-edit.template.html');

  const dockContent = fs.existsSync(dockFile) ? fs.readFileSync(dockFile, 'utf-8') : '';
  const sidebarContent = fs.existsSync(sidebarFile) ? fs.readFileSync(sidebarFile, 'utf-8') : '';
  const headerContent = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf-8') : '';
  const modalContent = fs.existsSync(modalFile) ? fs.readFileSync(modalFile, 'utf-8') : '';

  const viewNames = [
    'dashboard', 'studio', 'translation', 'mods', 'system',
    'entities', 'galaxy', 'convert', 'network', 'pipeline',
    'swarm', 'vault'
  ];

  let viewsContent = '';
  for (const v of viewNames) {
    const vPath = path.join(viewsDir, `${v}.template.html`);
    if (fs.existsSync(vPath)) {
      viewsContent += `\n${fs.readFileSync(vPath, 'utf-8')}`;
    }
  }

  let html = fs.readFileSync(appShellFile, 'utf-8');
  html = html
    .replace('{{dock}}', dockContent)
    .replace('{{sidebar}}', sidebarContent)
    .replace('{{header}}', headerContent)
    .replace('{{modal}}', modalContent)
    .replace('{{views}}', viewsContent);

  // Sync title and meta tags with metadata.json
  const metaTags = `
  <title>Solaris Nexus Studio</title>
  <meta name="description" content="Enterprise mod creation, localization, entity inspection, and galaxy topologist studio for Sins of a Solar Empire." />
  <meta property="og:title" content="Solaris Nexus Studio" />
  <meta property="og:description" content="Enterprise mod creation, localization, entity inspection, and galaxy topologist studio for Sins of a Solar Empire." />`;

  html = html.replace(/<title>.*?<\/title>/i, metaTags);

  return html;
}

if (process.argv[1] === __filename) {
  const html = assembleSpaHtml();
  fs.writeFileSync(path.join(rootDir, 'index.html'), html, 'utf-8');
  console.log('Successfully generated index.html at root');
}
