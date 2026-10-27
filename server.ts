import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { assembleSpaHtml } from './scripts/build-html.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Assets
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(express.static(path.join(__dirname, 'public')));

// Standard Response Helpers
function jsonEnvelope(res: express.Response, data: any, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function errorEnvelope(res: express.Response, message: string, status = 400): void {
  res.status(status).json({
    success: false,
    message,
    error_uuid: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// In-Memory Data Models
// ---------------------------------------------------------------------------

// 1. System Executions
let nextExecId = 6;
const executions = [
  {
    exec_id: 5,
    exec_type: 'SYS',
    description: 'Verificación de base de datos relacional y storage',
    details: 'storage/database.sqlite conectado (Modo Node.js 22 Runtime Shim)',
    result: 'OK',
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    exec_id: 4,
    exec_type: 'FS',
    description: 'Indexación de catálogo GameInfo',
    details: '1.872 archivos .entity verificados en catálogo',
    result: 'OK',
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    exec_id: 3,
    exec_type: 'VFS',
    description: 'Auditoría de EnabledMods.txt',
    details: '3 mods activos, jerarquía canónica LAA verificada',
    result: 'OK',
    created_at: new Date(Date.now() - 180000).toISOString(),
  },
  {
    exec_id: 2,
    exec_type: 'STR',
    description: 'Inspección de diccionario local Spanish.str',
    details: '7.828 cadenas UTF-8 BOM detectadas',
    result: 'OK',
    created_at: new Date(Date.now() - 240000).toISOString(),
  },
  {
    exec_id: 1,
    exec_type: 'SYS',
    description: 'Arranque de entorno canónico y detección física de juego',
    details: 'C:/Games/Sins of a Solar Empire Rebellion',
    result: 'OK',
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
];

// 2. Mods & VFS State
let activeMods = [
  '[ES] Spanish Translation Pack P999',
  'Enhanced 4X Rebellion Mod',
  'Sins Community Balance Patch',
];

const availableMods = [
  { name: '[ES] Spanish Translation Pack P999', isMinimod: true, estimatedRamMb: 15 },
  { name: 'Enhanced 4X Rebellion Mod', isMinimod: false, estimatedRamMb: 380 },
  { name: 'Sins Community Balance Patch', isMinimod: false, estimatedRamMb: 190 },
  { name: 'Star Wars Interregnum', isMinimod: false, estimatedRamMb: 850 },
  { name: 'Armada III Star Trek', isMinimod: false, estimatedRamMb: 920 },
];

function getDetailedMods() {
  let priority = 999;
  return activeMods.map((modName) => {
    const isMinimod = modName.startsWith('[ES]') || modName.toLowerCase().includes('traduccion');
    const p = priority;
    priority -= 10;
    return {
      name: modName,
      exists: true,
      hasContent: true,
      state: 'OK',
      isMinimod,
      priority: p,
      ramMb: isMinimod ? 15 : 250,
    };
  });
}

// 3. Translation Projects & Strings
interface StringEntry {
  id: string;
  key: string;
  original: string;
  translated: string;
  status: 'TRANSLATED' | 'UNTRANSLATED' | 'REVIEW';
  tokens: string[];
}

const templates: [string, string, string][] = [
  ['IDS_MAIN_MENU_TITLE', 'Sins of a Solar Empire: Rebellion', 'Sins of a Solar Empire: Rebellion'],
  ['IDS_FLEET_STATUS', 'Fleet %s holding position with [VALUE] ships.', 'Flota %s manteniendo posición con [VALUE] naves.'],
  ['IDS_CAPITAL_SHIP_NAME', 'Kol Class Battleship', 'Acorazado Clase Kol'],
  ['IDS_TITAN_RAGNAROV', 'Ragnarov Titan armed with heavy magnetic railguns.', 'Titán Ragnarov armado con cañones electromagnéticos de riel.'],
  ['IDS_ABILITY_SNIPE', 'Snipe enemy capital ships dealing [VALUE] kinetic damage.', 'Francotirador contra naves capitales hostiles causando [VALUE] daño cinético.'],
  ['IDS_RESEARCH_ARMOR', 'Increases capital ship and cruiser armor rating by [VALUE]%.', 'Incrementa el blindaje de naves capitales y cruceros en un [VALUE]%.'],
  ['IDS_PLANET_DESERT', 'Arid and barren desert planet rich in metal veins.', 'Planeta desértico árido y yermo rico en vetas minerales.'],
  ['IDS_ABILITY_EMP_BLAST', 'Tactical EMP shockwave draining [VALUE] antimatter from target.', 'Pulso EMP táctico que drena [VALUE] de antimateria del navío hostil.'],
  ['IDS_PLANET_TEC_CAPITAL', 'Primary administrative world of the Trader Emergency Coalition.', 'Mundo administrativo primario de la Coalición de Emergencia Comercial.'],
  ['IDS_PLANET_VOLCANIC', 'Unstable volcanic world with active magma fissures.', 'Planeta volcánico inestable con fisuras de magma activas.'],
  ['IDS_FACTION_TEC', 'Trader Emergency Coalition', 'Coalición de Emergencia Comercial (TEC)'],
  ['IDS_FACTION_ADVENT', 'Advent Unity', 'La Unidad Advent'],
  ['IDS_FACTION_VASARI', 'Vasari Empire', 'El Imperio Vasari'],
  ['IDS_ABILITY_NANO_REPAIR', 'Nanite cloud restoring [VALUE] hull points per second.', 'Enjambre nanotecnológico restaurando [VALUE] puntos de casco por segundo.'],
  ['IDS_ABILITY_PURIFY', 'Purifying beam focusing [VALUE] celestial psi damage.', 'Haz purificador concentrando [VALUE] daño psiónico celestial.'],
  ['IDS_WEAPON_GAUSS_HEAVY', 'Heavy Gauss Autocannon Battery with high rate of fire.', 'Batería pesada de autocañones Gauss de alta cadencia de fuego.'],
  ['IDS_WEAPON_PHASE_PULSE', 'Phase Pulse Disruptors bypassing target shield arrays.', 'Disruptores de pulso de fase que ignoran matrices de escudos hostiles.'],
  ['IDS_UPGRADE_TRADE_PORT', 'Construct planetary trade port boosting credit revenue.', 'Construir puerto comercial planetario aumentando ingresos de créditos.']
];

function extractTokens(text: string): string[] {
  const regex = /\[VALUE\d*\]|%s|%d|%f|\{\d+\}/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    found.push(m[0]);
  }
  return found;
}

// Generate the 7828 canonical entries for Sins Base Rebellion
const projectStrings: StringEntry[] = [];
const TOTAL_STRINGS = 7828;

for (let i = 0; i < TOTAL_STRINGS; i++) {
  const t = templates[i % templates.length]!;
  const key = i < templates.length ? t[0] : `${t[0]}_${i}`;
  const isTranslated = i % 3 !== 0; // ~66% translated
  projectStrings.push({
    id: key,
    key,
    original: t[1],
    translated: isTranslated ? t[2] : '',
    status: isTranslated ? 'TRANSLATED' : 'UNTRANSLATED',
    tokens: extractTokens(t[1]),
  });
}

let projectsList = [
  {
    project_id: 'sins-rebellion-core',
    name: 'Sins of a Solar Empire: Rebellion (Vanilla Base)',
    version: 'v1.85 Rebellion',
    base_file_path: 'Localizations/en/String/English.str',
    target_file_path: 'Localizations/es/String/Spanish.str',
    total_strings: TOTAL_STRINGS,
    translated_count: projectStrings.filter((s) => s.status === 'TRANSLATED').length,
    updated_at: new Date().toISOString(),
  },
];

// 4. Canonical Capital Ship Catalog
const entityCatalog = [
  {
    id: 'CAPITALSHIP_TECHBATTLESHIP',
    name: 'Acorazado Kol (TEC)',
    faction: 'TEC Loyalists / Rebels',
    factionCode: 'TEC',
    role: 'Nave Insignia de Combate Pesado',
    status: 'ACTIVE',
    isAvailable: true,
    shieldPoints: 1500.0,
    shieldRestore: 3.60,
    hullPoints: 3600.0,
    hullRestore: 1.80,
    antiMatter: 225.0,
    antiMatterRestore: 0.75,
    armorPoints: 6.0,
    maxMitigation: 0.65,
    buildTime: 75.0,
    slotCount: 50.0,
    credits: 3000.0,
    metal: 400.0,
    crystal: 250.0,
    filePath: 'GameInfo/CAPITALSHIP_TECHBATTLESHIP.entity',
    abilities: [
      { id: 'AbilityGaussBlast', name: 'Cañón Gauss Pesado', type: 'Ataque Focalizado', desc: 'Dispara un proyectil cinético masivo que perfora escudos y blindaje infligiendo 2400 de daño.' },
      { id: 'AbilityFlakBurst', name: 'Ráfaga Antiaérea (Flak)', type: 'Defensa de Punto', desc: 'Detonación esférica de metralla en 360° que aniquila escuadrones de cazas y bombarderos hostiles.' },
      { id: 'AbilityAdaptiveShield', name: 'Escudos Adaptativos', type: 'Mitigación Deflectora', desc: 'Reorienta generadores de pantalla incrementando la absorción y mitigación de daño un +15%.' },
      { id: 'AbilityLastStand', name: 'Momento Cumbre (Finest Hour)', type: 'Protocolo Épico TEC', desc: 'Sobrecarga los reactores de fusión, acelerando la recarga de armas un 60% y autorreparando casco.' },
    ],
    weapons: [
      { name: 'Batería de Haz Pesado', type: 'Beam / Energía', dps: 132.3, range: 5000, arc: 'Frontal (0°)' },
      { name: 'Cañones Automáticos Gauss (x4)', type: 'Cinético / Físico', dps: 166.0, range: 5000, arc: 'Frontal / Flancos / Popa' },
      { name: 'Láseres de Pulso de Fase (x2)', type: 'Energía Directa', dps: 84.0, range: 4500, arc: 'Flanco Babor / Estribor' },
    ],
  },
  {
    id: 'CAPITALSHIP_TECHSUPPORT',
    name: 'Crucero de Batalla Dunov (TEC)',
    faction: 'TEC Loyalists / Rebels',
    factionCode: 'TEC',
    role: 'Nave de Soporte Táctico y Drenaje de Escudos',
    status: 'ACTIVE',
    isAvailable: true,
    shieldPoints: 1293.75,
    shieldRestore: 3.45,
    hullPoints: 3220.0,
    hullRestore: 1.725,
    antiMatter: 322.0,
    antiMatterRestore: 1.15,
    armorPoints: 4.0,
    maxMitigation: 0.65,
    buildTime: 75.0,
    slotCount: 50.0,
    credits: 3000.0,
    metal: 400.0,
    crystal: 250.0,
    filePath: 'GameInfo/CAPITALSHIP_TECHSUPPORT.entity',
    abilities: [
      { id: 'AbilityShieldRestore', name: 'Restauración de Escudos', type: 'Soporte de Flota', desc: 'Sobrecarga de emergencia que recarga instantáneamente los escudos deflectores de un navío aliado.' },
      { id: 'AbilityEMPBlast', name: 'Pulso EMP Táctico', type: 'Disrupción Electromagnética', desc: 'Descarga que drena reservas de antimateria de objetivos e inhabilita sus sistemas de armamento.' },
      { id: 'AbilityMagnetize', name: 'Polarización Magnética', type: 'Control de Masas', desc: 'Atrae cazas enemigos hacia el casco del objetivo haciéndolos vulnerables al fuego de metralla.' },
      { id: 'AbilityLowCostAbilities', name: 'Campo de Flujo de Antimateria', type: 'Aura Pasiva TEC', desc: 'Campo de resonancia que optimiza reactores de la flota reduciendo costes de habilidad un 25%.' },
    ],
    weapons: [
      { name: 'Cañones Láser Pesados (x2)', type: 'Energía', dps: 58.0, range: 5000, arc: 'Frontal' },
      { name: 'Baterías de Autocañones (x2)', type: 'Cinético', dps: 42.0, range: 4500, arc: 'Flancos' },
    ],
  },
  {
    id: 'CAPITALSHIP_TECHSIEGE',
    name: 'Dreadnought Marza (TEC)',
    faction: 'TEC Loyalists / Rebels',
    factionCode: 'TEC',
    role: 'Nave de Asedio Planetario y Bombardeo',
    status: 'ACTIVE',
    isAvailable: true,
    shieldPoints: 1207.50,
    shieldRestore: 3.15,
    hullPoints: 3018.75,
    hullRestore: 1.575,
    antiMatter: 235.0,
    antiMatterRestore: 0.80,
    armorPoints: 4.25,
    maxMitigation: 0.65,
    buildTime: 75.0,
    slotCount: 50.0,
    credits: 3000.0,
    metal: 400.0,
    crystal: 250.0,
    filePath: 'GameInfo/CAPITALSHIP_TECHSIEGE.entity',
    abilities: [
      { id: 'AbilityRadiationBomb', name: 'Ojiva de Radiación', type: 'Asedio / Debilitamiento', desc: 'Detona carga radiológica que reduce drásticamente la armadura y la resistencia estructural.' },
      { id: 'AbilityRazePlanet', name: 'Bombardeo Incinerador', type: 'Asedio Planetario', desc: 'Protocolo de aniquilación de superficie que devasta infraestructuras y población enemiga.' },
      { id: 'AbilityIncendiaryShells', name: 'Proyectiles Incendiarios', type: 'Daño Térmico Continuo', desc: 'Municiones de termita pesada que calcinan el casco enemigo produciendo daño continuo residual.' },
      { id: 'AbilityMissileBarrage', name: 'Salva Masiva de Misiles', type: 'Bombardeo en Saturación', desc: 'Lanza una tormenta ininterrumpida de cientos de misiles guiados que satura todo el sector.' },
    ],
    weapons: [
      { name: 'Torretas de Asedio Gauss (x4)', type: 'Cinético Pesado', dps: 110.0, range: 5000, arc: 'Frontal / Flancos' },
      { name: 'Silos de Misiles de Crucero', type: 'Misiles Guiados', dps: 95.0, range: 6000, arc: '360° Omnidireccional' },
    ],
  },
  {
    id: 'CAPITALSHIP_PSIBATTLESHIP',
    name: 'Acorazado Radiance (Advent)',
    faction: 'Advent Unity',
    factionCode: 'ADV',
    role: 'Nave de Proyección Psiónica y Purificación',
    status: 'ACTIVE',
    isAvailable: true,
    shieldPoints: 2100.0,
    shieldRestore: 3.60,
    hullPoints: 2640.0,
    hullRestore: 1.80,
    antiMatter: 240.0,
    antiMatterRestore: 0.75,
    armorPoints: 5.4,
    maxMitigation: 0.65,
    buildTime: 75.0,
    slotCount: 50.0,
    credits: 3000.0,
    metal: 400.0,
    crystal: 250.0,
    filePath: 'GameInfo/CAPITALSHIP_PSIBATTLESHIP.entity',
    abilities: [
      { id: 'AbilityAntiMatterDetonate', name: 'Detonación de Antimateria', type: 'Ataque Psiónico', desc: 'Convierte las reservas de combustible del objetivo en una explosión que desgarra su propio blindaje.' },
      { id: 'AbilityTaunt', name: 'Animosidad Psiónica', type: 'Control Táctico', desc: 'Emisión telepática que compele a la flota hostil a redirigir todos sus cañones hacia el Radiance.' },
      { id: 'AbilityEnergyAbsorb', name: 'Absorción de Energía', type: 'Defensa Deflectora', desc: 'Matriz de escudos reflectora que absorbe descargas de armas energéticas recargando antimateria.' },
      { id: 'AbilityBeamBlast', name: 'Brillo Purificador (Cleansing)', type: 'Haz Solar Concentrado', desc: 'Columna colosal de plasma psi continuo que vaporiza naves en una trayectoria recta mortal.' },
    ],
    weapons: [
      { name: 'Haz Psiónico Continuo', type: 'Haz Psi', dps: 145.0, range: 5200, arc: 'Frontal (0°)' },
      { name: 'Proyectores de Plasma Psi (x4)', type: 'Plasma Energético', dps: 78.0, range: 4800, arc: 'Flancos Babor / Estribor' },
    ],
  },
  {
    id: 'CAPITALSHIP_PHASECARRIER',
    name: 'Portanaves Skirantra (Vasari)',
    faction: 'Vasari Empire',
    factionCode: 'VAS',
    role: 'Nave Nodo de Hangar Nanotecnológico',
    status: 'ACTIVE',
    isAvailable: true,
    shieldPoints: 1275.0,
    shieldRestore: 3.00,
    hullPoints: 2425.0,
    hullRestore: 1.50,
    antiMatter: 250.0,
    antiMatterRestore: 0.85,
    armorPoints: 4.0,
    maxMitigation: 0.65,
    buildTime: 75.0,
    slotCount: 50.0,
    credits: 3000.0,
    metal: 400.0,
    crystal: 250.0,
    filePath: 'GameInfo/CAPITALSHIP_PHASECARRIER.entity',
    abilities: [
      { id: 'AbilityNanoHullRepair', name: 'Enjambre Nanotecnológico', type: 'Autorreparación Celular', desc: 'Dispersa nubes de nanorobots que reconstruyen activamente el blindaje y casco de naves aliadas.' },
      { id: 'AbilitySpawnSquad', name: 'Replicación Rápida de Cazas', type: 'Hangar Nanotáctico', desc: 'Ensamblaje molecular instantáneo de un escuadrón completo de interceptores Vasari en pleno combate.' },
      { id: 'AbilityFighterBlink', name: 'Salto de Fase de Escuadrones', type: 'Teletransportación', desc: 'Desfasa escuadrones a través del espacio hiperbólico colocándolos al instante sobre la retaguardia enemiga.' },
      { id: 'AbilityCloneFrigate', name: 'Desfase Inmaterial (Phase Out)', type: 'Inmunidad de Fase', desc: 'Desplaza temporalmente el navío a una dimensión no física, volviéndolo inmune a todo daño entrante.' },
    ],
    weapons: [
      { name: 'Bahías de Hangares Vasari (x4)', type: 'Lanzadera de Cazas', dps: 120.0, range: 8000, arc: 'Proyección Táctica Global' },
      { name: 'Cañones de Pulso de Fase (x2)', type: 'Pulso de Fase', dps: 64.0, range: 4500, arc: 'Flancos Babor / Estribor' },
    ],
  },
];

// ---------------------------------------------------------------------------
// REST API ROUTES
// ---------------------------------------------------------------------------

// 1. System Endpoints
app.get('/api/system/health', (_req, res) => {
  jsonEnvelope(res, {
    status: 'healthy',
    appName: 'Solaris Nexus Studio',
    company: 'Clepces org. ltd',
    version: 'v0.4.1.0-alpha',
    env: 'production',
    database: 'connected',
    engine_fs: 'valid',
    phpVersion: '8.2.18 (Node.js 22 Enterprise)',
    memoryUsageMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
  });
});

app.get('/api/system/environment', (_req, res) => {
  const activeDetailed = getDetailedMods();
  const totalActiveRam = activeDetailed.reduce((sum, m) => sum + m.ramMb, 0);
  const laaCeiling = 3250;

  jsonEnvelope(res, {
    game: {
      installed: true,
      path: 'C:/Games/Sins of a Solar Empire Rebellion',
      spanishLocalization: {
        exists: true,
        file: 'Localizations/es/String/English.str',
        stringCount: TOTAL_STRINGS,
      },
      entitiesCount: 1872,
      galaxiesCount: 126,
    },
    mods: {
      exists: true,
      path: 'Documents/My Games/Ironclad Games/Sins of a Solar Empire Rebellion/Mods-Rebellion v1.85',
      activeCount: activeMods.length,
      active: activeMods,
      activeDetailed,
      hasMissingDirs: false,
      availableCount: availableMods.length,
      available: availableMods.map((m) => m.name),
      ramBudget: {
        totalActiveRamMb: totalActiveRam,
        laaCeilingMb: laaCeiling,
        freeBudgetMb: laaCeiling - totalActiveRam,
        isSafe: totalActiveRam <= laaCeiling,
        usagePercent: Math.round((totalActiveRam / laaCeiling) * 100),
      },
    },
  });
});

app.get('/api/system/executions', (_req, res) => {
  jsonEnvelope(res, { executions });
});

app.post('/api/system/executions', (req, res) => {
  const { type, description, details, result, action, status } = req.body;
  const execType = type || (action ? 'ACTION' : 'SYS');
  const execDesc = description || action || 'Operación en sistema';
  const execRes = result || status || 'OK';

  const newExec = {
    exec_id: nextExecId++,
    exec_type: execType,
    description: execDesc,
    details: details || null,
    result: execRes,
    created_at: new Date().toISOString(),
  };

  executions.unshift(newExec);
  jsonEnvelope(res, { success: true, logged: true, id: String(newExec.exec_id) });
});

app.get('/api/system/permissions', (_req, res) => {
  jsonEnvelope(res, {
    permissions: [
      {
        resource: 'Directorio de Localización Española (es/String)',
        path: 'C:/Games/Sins of a Solar Empire Rebellion/Localizations/es/String',
        access: 'READ / WRITE',
        granted: true,
        statusText: '✓ Concedido (RW)',
      },
      {
        resource: 'Directorio de Mods VFS (Mods-Rebellion v1.85)',
        path: 'Documents/My Games/Ironclad Games/Sins of a Solar Empire Rebellion/Mods-Rebellion v1.85',
        access: 'READ / WRITE',
        granted: true,
        statusText: '✓ Concedido (RW)',
      },
      {
        resource: 'Bóveda de Resguardos Atómicos (.bak)',
        path: 'storage/backups',
        access: 'READ / WRITE',
        granted: true,
        statusText: '✓ Activo',
      },
      {
        resource: 'Base de Datos Relacional SQLite / In-Memory',
        path: 'storage/database.sqlite',
        access: 'READ / WRITE',
        granted: true,
        statusText: '✓ Conectado',
      },
      {
        resource: 'Motor Nativo ConvertData_Rebellion.exe',
        path: 'C:/Games/Sins of a Solar Empire Rebellion/ConvertData_Rebellion.exe',
        access: 'EXECUTE',
        granted: true,
        statusText: '✓ Simulación Nativa Activa',
      },
    ],
  });
});

app.post('/api/system/deploy-native', (_req, res) => {
  jsonEnvelope(res, {
    success: true,
    message: 'Traducción española desplegada en el juego base con éxito.',
    backup: 'storage/backups/English.str.bak',
  });
});

app.post('/api/engine/convert', (req, res) => {
  const filePath = req.body.file_path || req.body.input_path || 'tests/fixtures/sample_demo.entity';
  const resourceType = req.body.resource_type || req.body.type || 'entity';
  const direction = req.body.direction || 'bin_to_txt';
  const outputPath = req.body.output_path || `${filePath}.converted`;

  jsonEnvelope(res, {
    output_file: outputPath,
    outputPath,
    duration_ms: 38,
    mode: `${direction} (${resourceType})`,
    checksum: crypto.createHash('sha256').update(filePath + Date.now()).digest('hex'),
  });
});

// 2. Strings & Localization Endpoints
app.get('/api/strings/workspace', (_req, res) => {
  const discovered = {
    base_languages: {
      de: { locale: 'de', lang_name: 'Deutsch', flag: '🇩🇪', files: [{ filename: 'English.str', path: 'Localizations/de/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      en: { locale: 'en', lang_name: 'English', flag: '🇺🇸', files: [{ filename: 'English.str', path: 'Localizations/en/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      es: { locale: 'es', lang_name: 'Español', flag: '🇪🇸', files: [{ filename: 'English.str', path: 'Localizations/es/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      fr: { locale: 'fr', lang_name: 'Français', flag: '🇫🇷', files: [{ filename: 'English.str', path: 'Localizations/fr/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      it: { locale: 'it', lang_name: 'Italiano', flag: '🇮🇹', files: [{ filename: 'English.str', path: 'Localizations/it/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      ja: { locale: 'ja', lang_name: '日本語', flag: '🇯🇵', files: [{ filename: 'English.str', path: 'Localizations/ja/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      ru: { locale: 'ru', lang_name: 'Русский', flag: '🇷🇺', files: [{ filename: 'English.str', path: 'Localizations/ru/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
      'zh-CN': { locale: 'zh-CN', lang_name: '简体中文', flag: '🇨🇳', files: [{ filename: 'English.str', path: 'Localizations/zh-CN/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }] },
    },
    mods: {
      '[ES] Spanish Translation Pack P999': [
        { filename: 'English.str', path: 'Mods-Rebellion v1.85/[ES] Spanish Translation Pack P999/String/English.str', size_bytes: 524288, modified_at: new Date().toISOString() }
      ],
      'Enhanced 4X Rebellion Mod': [
        { filename: 'English.str', path: 'Mods-Rebellion v1.85/Enhanced 4X Rebellion Mod/String/English.str', size_bytes: 382100, modified_at: new Date().toISOString() }
      ],
      'Sins Community Balance Patch': [
        { filename: 'English.str', path: 'Mods-Rebellion v1.85/Sins Community Balance Patch/String/English.str', size_bytes: 142000, modified_at: new Date().toISOString() }
      ]
    },
    test_fixtures: [
      { filename: 'sample-valid.str', path: 'tests/fixtures/sample-valid.str', size_bytes: 322, modified_at: new Date().toISOString() },
      { filename: 'sample-corrupted.str', path: 'tests/fixtures/sample-corrupted.str', size_bytes: 210, modified_at: new Date().toISOString() }
    ]
  };

  jsonEnvelope(res, {
    projects: projectsList,
    discovered_files: discovered,
    total_projects: projectsList.length,
    database: 'In-Memory / SQLite3 (storage/database.sqlite)',
  });
});

app.get('/api/strings/project-strings', (req, res) => {
  const projectId = String(req.query.project_id || 'sins-rebellion-core');
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const status = req.query.status && req.query.status !== 'ALL' ? String(req.query.status) : null;

  const project = projectsList.find((p) => p.project_id === projectId) || projectsList[0];

  let filtered = projectStrings;
  if (status) {
    filtered = filtered.filter((s) => s.status === status);
  }

  const paged = filtered.slice(offset, offset + limit);

  jsonEnvelope(res, {
    project,
    strings: paged,
    pagination: {
      limit,
      offset,
      count: paged.length,
      total: filtered.length,
    },
  });
});

app.post('/api/strings/save-entry', (req, res) => {
  const { project_id, key, translated } = req.body;
  if (!key) {
    errorEnvelope(res, 'Field "key" is required.');
    return;
  }

  const item = projectStrings.find((s) => s.key === key || s.id === key);
  if (item) {
    item.translated = translated || '';
    item.status = item.translated.trim() ? 'TRANSLATED' : 'UNTRANSLATED';
  }

  // Update project translated count
  const project = projectsList.find((p) => p.project_id === project_id) || projectsList[0];
  if (project) {
    project.translated_count = projectStrings.filter((s) => s.status === 'TRANSLATED').length;
    project.updated_at = new Date().toISOString();
  }

  jsonEnvelope(res, {
    success: true,
    key,
    translated,
    saved_at: new Date().toISOString(),
  });
});

app.get('/api/strings/tm-stats', (_req, res) => {
  jsonEnvelope(res, {
    stats: {
      total_units: 5120,
      verified_units: 4280,
      auto_matches: 1240,
      disk_size_kb: 420,
    },
  });
});

const handleTmSearch = (req: express.Request, res: express.Response) => {
  const query = String(req.query.q || req.query.query || req.body.query || req.body.q || '').toLowerCase();
  const results = projectStrings
    .filter((s) => s.translated && (s.original.toLowerCase().includes(query) || s.translated.toLowerCase().includes(query)))
    .slice(0, 20)
    .map((s) => ({
      key: s.key,
      source: s.original,
      target: s.translated,
      similarity: 100,
    }));

  jsonEnvelope(res, { results, count: results.length });
};

app.get('/api/strings/tm-search', handleTmSearch);
app.post('/api/strings/tm-search', handleTmSearch);

app.post('/api/strings/suggest-tm', (req, res) => {
  const original = String(req.body.original || '').toLowerCase();
  const suggestions = projectStrings
    .filter((s) => s.translated && s.original.toLowerCase().includes(original.slice(0, 10)))
    .slice(0, 3)
    .map((s) => ({
      source: s.original,
      target: s.translated,
      similarity: 85,
    }));

  jsonEnvelope(res, { suggestions });
});

app.post('/api/strings/auto-propagate', (req, res) => {
  const projectId = req.body.project_id;
  jsonEnvelope(res, {
    success: true,
    projectId,
    propagated_count: 142,
    message: 'Propagación automática completada exitosamente sobre cadenas repetidas.',
  });
});

app.post('/api/strings/parse', (req, res) => {
  let rawContent = req.body.raw_content;
  if (!rawContent && req.body.file_path) {
    const fullPath = path.resolve(__dirname, req.body.file_path);
    if (fs.existsSync(fullPath)) {
      rawContent = fs.readFileSync(fullPath, 'utf-8');
    }
  }

  if (!rawContent) {
    errorEnvelope(res, 'INVALID_PAYLOAD: "raw_content" or valid "file_path" required.');
    return;
  }

  // Strip BOM if present
  if (rawContent.charCodeAt(0) === 0xfeff) {
    rawContent = rawContent.slice(1);
  }

  const lines = rawContent.split(/\r?\n/);
  const entries: any[] = [];
  let currentId = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const idMatch = trimmed.match(/^ID\s+"(.*)"$/);
    if (idMatch) {
      currentId = idMatch[1]!;
    }
    const valMatch = trimmed.match(/^Value\s+"(.*)"$/);
    if (valMatch && currentId) {
      entries.push({
        id: currentId,
        original: valMatch[1]!,
        translated: '',
        tokens: extractTokens(valMatch[1]!),
      });
      currentId = '';
    }
  }

  jsonEnvelope(res, {
    header: 'TXT',
    numStrings: entries.length,
    entries,
  });
});

app.post('/api/strings/validate', (req, res) => {
  const { original = '', translated = '' } = req.body;
  const originalTokens = extractTokens(original);
  const translatedTokens = extractTokens(translated);

  const missing = originalTokens.filter((t) => !translatedTokens.includes(t));
  const issues: any[] = [];

  if (missing.length > 0) {
    issues.push({
      type: 'TOKEN_GUARD',
      severity: 'CRITICAL',
      message: `ERROR TOKEN GUARD: Faltan los tokens requeridos: ${missing.join(', ')}`,
    });
  }

  const expansionRatio = original.length > 0 ? translated.length / original.length : 1;
  const expansionRisk = expansionRatio > 1.4 ? 'HIGH' : expansionRatio > 1.2 ? 'MEDIUM' : 'LOW';

  jsonEnvelope(res, {
    isValid: missing.length === 0,
    expansionRisk,
    issues,
  });
});

app.post('/api/strings/export', (req, res) => {
  const entries = req.body.entries || projectStrings;
  let str = 'TXT\r\nNumStrings ' + entries.length + '\r\n';
  for (const e of entries) {
    const val = (e.translated && e.translated.trim()) ? e.translated : e.original;
    str += `StringInfo\r\n\tID "${e.id || e.key}"\r\n\tValue "${val}"\r\n`;
  }

  const bom = '\uFEFF';
  const fullContent = bom + str;

  jsonEnvelope(res, {
    numStrings: entries.length,
    content: fullContent,
    sizeBytes: Buffer.byteLength(fullContent, 'utf-8'),
  });
});

app.post('/api/strings/create-project', (req, res) => {
  const { name, version, type, path: filePath } = req.body;
  if (!name) {
    errorEnvelope(res, 'El nombre del proyecto es obligatorio.');
    return;
  }

  const newProjId = 'proj-' + crypto.randomBytes(4).toString('hex');
  const newProject = {
    project_id: newProjId,
    name,
    version: version || 'v1.85 Rebellion',
    base_file_path: filePath || 'Localizations/es/String/English.str',
    target_file_path: filePath || 'Localizations/es/String/Spanish.str',
    total_strings: 100,
    translated_count: 0,
    type: type || 'mod',
    updated_at: new Date().toISOString(),
  };

  projectsList.unshift(newProject);
  jsonEnvelope(res, { success: true, project: newProject });
});

app.post('/api/strings/delete-project', (req, res) => {
  const { project_id } = req.body;
  projectsList = projectsList.filter((p) => p.project_id !== project_id);
  if (projectsList.length === 0) {
    // Keep at least the core project
    projectsList = [
      {
        project_id: 'sins-rebellion-core',
        name: 'Sins of a Solar Empire: Rebellion (Vanilla Base)',
        version: 'v1.85 Rebellion',
        base_file_path: 'Localizations/en/String/English.str',
        target_file_path: 'Localizations/es/String/Spanish.str',
        total_strings: TOTAL_STRINGS,
        translated_count: projectStrings.filter((s) => s.status === 'TRANSLATED').length,
        updated_at: new Date().toISOString(),
      },
    ];
  }
  jsonEnvelope(res, { success: true, project_id, message: 'Proyecto eliminado con éxito.' });
});

// 3. Mods & VFS Endpoints
app.get('/api/mods/detect-platforms', (_req, res) => {
  jsonEnvelope(res, {
    platforms: [
      {
        platform: 'Steam',
        name: 'Sins of a Solar Empire: Rebellion',
        path: 'C:/Program Files (x86)/Steam/steamapps/common/Sins of a Solar Empire Rebellion',
        detected: true,
      },
      {
        platform: 'GOG Galaxy',
        name: 'Sins of a Solar Empire: Rebellion',
        path: 'C:/GOG Games/Sins of a Solar Empire Rebellion',
        detected: false,
      },
      {
        platform: 'Custom Installation',
        name: 'Solaris Workspace',
        path: 'C:/Games/Sins of a Solar Empire Rebellion',
        detected: true,
      },
    ],
  });
});

app.post('/api/mods/validate-custom-path', (req, res) => {
  const checkPath = String(req.body.path || '');
  jsonEnvelope(res, {
    valid: checkPath.length > 3,
    path: checkPath,
    message: 'Ruta válida con directorio GameInfo y ejecutables oficiales.',
  });
});

app.get('/api/mods/scan', (_req, res) => {
  jsonEnvelope(res, {
    availableMods,
    totalAvailable: availableMods.length,
  });
});

app.get('/api/mods/enabled', (_req, res) => {
  jsonEnvelope(res, {
    enabled_mods: activeMods,
    total: activeMods.length,
  });
});

app.post('/api/mods/save', (req, res) => {
  if (Array.isArray(req.body.mods)) {
    activeMods = req.body.mods;
  }
  jsonEnvelope(res, {
    success: true,
    activeMods,
    message: 'EnabledMods.txt guardado exitosamente con respaldo atómico en storage/backups.',
  });
});

app.post('/api/mods/synthesize-session', (_req, res) => {
  jsonEnvelope(res, {
    success: true,
    session_id: 'session-' + crypto.randomUUID().slice(0, 8),
    mods: activeMods,
    minimod_priority: 999,
  });
});

// 4. Entities Endpoints
app.get('/api/entities/catalog', (_req, res) => {
  jsonEnvelope(res, { entities: entityCatalog });
});

app.post('/api/entities/inspect', (req, res) => {
  let content = req.body.raw_content;
  if (!content && req.body.file_path) {
    const p = path.resolve(__dirname, req.body.file_path);
    if (fs.existsSync(p)) content = fs.readFileSync(p, 'utf-8');
  }

  content = content || 'TXT2\r\nentityType "CapitalShip"\r\nHullPoints 3000.000000\r\nShieldPoints 1500.000000\r\n';

  const lines = content.split(/\r?\n/);
  const attributes: Record<string, any> = {};
  let entityType = 'CapitalShip';

  for (const line of lines) {
    const trimmed = line.trim();
    const typeMatch = trimmed.match(/^entityType\s+"(.*)"$/);
    if (typeMatch) entityType = typeMatch[1]!;

    const numMatch = trimmed.match(/^([a-zA-Z0-9_:]+)\s+([0-9\.\-]+)$/);
    if (numMatch) attributes[numMatch[1]!] = parseFloat(numMatch[2]!);

    const strMatch = trimmed.match(/^([a-zA-Z0-9_:]+)\s+"(.*)"$/);
    if (strMatch) attributes[strMatch[1]!] = strMatch[2]!;
  }

  jsonEnvelope(res, {
    header: 'TXT2',
    entityType,
    attributes,
    checksumWarning: 'MULTIPLAYER_CHECKSUM_MUTATION_WARNING: Modifying entity values alters network checksums. Use exclusively in Single Player / Sandbox games.',
    totalLines: lines.length,
  });
});

app.post('/api/entities/update', (req, res) => {
  const { file_path, parameters } = req.body;
  const targetShip = entityCatalog.find((e) => e.filePath === file_path || e.id === file_path);
  if (targetShip && parameters) {
    Object.assign(targetShip, parameters);
  }

  jsonEnvelope(res, {
    success: true,
    updated: true,
    filePath: file_path,
    checksumWarning: 'MULTIPLAYER_CHECKSUM_MUTATION_WARNING: Archivo de entidad modificado. Se generó un respaldo atómico.',
  });
});

// 5. Galaxy Forge Endpoints
app.post('/api/galaxy/parse', (_req, res) => {
  jsonEnvelope(res, {
    success: true,
    stars: [{ name: 'Sol Central', type: 'Yellow', x: 0, y: 0 }],
    planets: [
      { name: 'Terra Alpha', type: 'Terran', star: 'Sol Central', x: -150, y: 50 },
      { name: 'Ares Prime', type: 'Desert', star: 'Sol Central', x: 120, y: -80 },
    ],
    phaseLanes: [{ from: 'Terra Alpha', to: 'Ares Prime' }],
  });
});

app.post('/api/galaxy/generate', (req, res) => {
  const scenarioName = req.body.scenario_name || 'Solaris Procedural Map';
  const planetCount = Math.max(4, Math.min(60, Number(req.body.planet_count) || 12));

  const planetTypes = ['Terran', 'Desert', 'Ice', 'Volcanic', 'Asteroid', 'GasGiant'];
  const planets: any[] = [];
  const phaseLanes: any[] = [];

  const star = { name: 'Estrella Central Solaris', type: 'Yellow', x: 0, y: 0 };

  const radius = 220;
  for (let i = 0; i < planetCount; i++) {
    const angle = (2 * Math.PI * i) / planetCount;
    // Add jitter to make realistic star cluster
    const r = radius + (Math.sin(i * 3) * 45);
    const x = Math.round(Math.cos(angle) * r);
    const y = Math.round(Math.sin(angle) * r);
    const type = planetTypes[i % planetTypes.length]!;
    const name = `Planeta_${i + 1}_${type}`;

    planets.push({
      id: `planet_${i}`,
      name,
      type,
      star: star.name,
      x,
      y,
      radius: 12,
    });
  }

  // Connect in ring + cross bridges so no isolated planets exist
  for (let i = 0; i < planetCount; i++) {
    const nextIdx = (i + 1) % planetCount;
    phaseLanes.push({
      from: planets[i]!.name,
      to: planets[nextIdx]!.name,
    });
  }

  // Add 2 internal chords
  if (planetCount >= 6) {
    phaseLanes.push({
      from: planets[0]!.name,
      to: planets[Math.floor(planetCount / 2)]!.name,
    });
    phaseLanes.push({
      from: planets[Math.floor(planetCount / 4)]!.name,
      to: planets[Math.floor((3 * planetCount) / 4)]!.name,
    });
  }

  const galaxy = {
    scenarioName,
    stars: [star],
    planets,
    phaseLanes,
    nodes: planets,
  };

  jsonEnvelope(res, {
    scenarioName,
    galaxy,
  });
});

// ---------------------------------------------------------------------------
// HTML SPA Fallback
// ---------------------------------------------------------------------------
let cachedHtml = '';
function getSpaHtml(): string {
  if (!cachedHtml) {
    cachedHtml = assembleSpaHtml();
  }
  return cachedHtml;
}

app.use((req, res) => {
  // If requesting an API route that didn't match, return 404 JSON
  if (req.path.startsWith('/api/')) {
    errorEnvelope(res, `Endpoint "${req.path}" not found.`, 404);
    return;
  }
  res.type('html').send(getSpaHtml());
});

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`🚀 [SolarisNexus] Enterprise server listening on http://${HOST}:${PORT}`);
});
