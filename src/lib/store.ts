import seed from '../data/seed.json';

// ---------- Tipos ----------
export type Reglas = typeof seed.reglas;
export interface Usuario {
  id: string; nombre: string; codigo: string; telefono: string; puntos: number;
  tiendaId: string; tarjetaFisica: boolean; quizHecho: boolean;
}
export interface Tienda {
  id: string; nombre: string; zona: string; direccion: string; horario: string;
  litrosBidon: number; recoleccionSolicitada: boolean;
}
export type TipoMov = 'entrega' | 'rechazo' | 'canje' | 'sorteo' | 'quiz';
export interface Movimiento {
  id: string; tipo: TipoMov; usuarioId: string; tiendaId: string | null;
  litros: number; puntos: number; detalle: string; fecha: string;
}
export interface Producto { id: string; nombre: string; costoPuntos: number; emoji: string }
export interface Sorteo {
  id: string; premio: string; emoji: string; fecha: string; costoBoleto: number;
  boletos: string[]; ganadorId: string | null;
}
export interface Recoleccion { id: string; tiendaId: string; litros: number; pagoUSD: number; fecha: string }
export interface DB {
  version: number; reglas: Reglas; usuarios: Usuario[]; tiendas: Tienda[];
  movimientos: Movimiento[]; catalogo: Producto[]; sorteos: Sorteo[]; recolecciones: Recoleccion[];
}

const KEY = 'gqs-db';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// ---------- Persistencia ----------
export function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* localStorage bloqueado o JSON corrupto: usamos la semilla */ }
  const db = clone(seed) as DB;
  save(db);
  return db;
}

export function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* modo privado */ }
}

export function reset(): DB {
  const db = clone(seed) as DB;
  save(db);
  return db;
}

export function exportJSON(db: DB) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gota-que-suma-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importJSON(file: File): Promise<DB> {
  const db = JSON.parse(await file.text()) as DB;
  if (!db.usuarios || !db.tiendas || !db.reglas) throw new Error('El archivo no es un respaldo válido.');
  save(db);
  return db;
}

// ---------- Preferencias de la demo (quién está "logueado") ----------
export const pref = {
  get(k: string, def = '') { try { return localStorage.getItem('gqs-' + k) ?? def; } catch { return def; } },
  set(k: string, v: string) { try { localStorage.setItem('gqs-' + k, v); } catch { /* */ } },
};

// ---------- Utilidades ----------
const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const hoy = () => new Date().toISOString().slice(0, 10);

export const usuario = (db: DB, id: string) => db.usuarios.find(u => u.id === id);
export const tienda = (db: DB, id: string | null) => db.tiendas.find(t => t.id === id);
export const porCodigo = (db: DB, codigo: string) =>
  db.usuarios.find(u => u.codigo.toUpperCase() === codigo.trim().toUpperCase());

export const movsDe = (db: DB, usuarioId: string) =>
  db.movimientos.filter(m => m.usuarioId === usuarioId).sort((a, b) => b.fecha.localeCompare(a.fecha));

export const litrosDe = (db: DB, usuarioId: string) =>
  db.movimientos.filter(m => m.usuarioId === usuarioId && m.tipo === 'entrega').reduce((s, m) => s + m.litros, 0);

/** Litros aceptados hoy para una persona (límite antifraude). */
export const litrosHoy = (db: DB, usuarioId: string) =>
  db.movimientos
    .filter(m => m.usuarioId === usuarioId && m.tipo === 'entrega' && m.fecha.startsWith(hoy()))
    .reduce((s, m) => s + m.litros, 0);

export const totalLitros = (db: DB) =>
  db.movimientos.filter(m => m.tipo === 'entrega').reduce((s, m) => s + m.litros, 0);

// ---------- Acciones ----------
export function registrarEntrega(db: DB, p: { usuarioId: string; tiendaId: string; litros: number; aceptado: boolean; motivo?: string }) {
  const u = usuario(db, p.usuarioId);
  const t = tienda(db, p.tiendaId);
  if (!u || !t) throw new Error('Cliente o tienda no encontrados.');
  if (!(p.litros > 0)) throw new Error('Ingresa una cantidad de litros válida.');

  if (!p.aceptado) {
    db.movimientos.push({ id: uid('M'), tipo: 'rechazo', usuarioId: u.id, tiendaId: t.id, litros: p.litros, puntos: 0, detalle: 'Rechazado: ' + (p.motivo || 'aceite contaminado'), fecha: new Date().toISOString() });
    save(db);
    return { puntos: 0, sellosDesde: 0, sellosHasta: 0 };
  }

  const disponible = db.reglas.limiteLitrosDiaPorPersona - litrosHoy(db, u.id);
  if (p.litros > disponible) throw new Error(`Límite diario: a esta persona solo se le pueden recibir ${Math.max(0, disponible)} L más hoy.`);
  const libre = db.reglas.capacidadBidonTienda - t.litrosBidon;
  if (p.litros > libre) throw new Error(`El bidón solo tiene espacio para ${libre} L. Solicita la recolección.`);

  const antes = Math.floor(litrosDe(db, u.id));
  const puntos = Math.round(p.litros * db.reglas.puntosPorLitro);
  u.puntos += puntos;
  t.litrosBidon = +(t.litrosBidon + p.litros).toFixed(2);
  if (t.litrosBidon / db.reglas.capacidadBidonTienda * 100 >= db.reglas.alertaBidonPorcentaje) t.recoleccionSolicitada = true;
  db.movimientos.push({ id: uid('M'), tipo: 'entrega', usuarioId: u.id, tiendaId: t.id, litros: p.litros, puntos, detalle: 'Aceite aceptado' + (u.tarjetaFisica ? ' · tarjeta física' : ''), fecha: new Date().toISOString() });
  save(db);
  const despues = Math.floor(litrosDe(db, u.id));
  // Casillas que la tienda debe sellar en la tarjeta de papel (1 casilla = 1 litro).
  return { puntos, sellosDesde: antes + 1, sellosHasta: despues };
}

export function canjear(db: DB, usuarioId: string, tiendaId: string, productoId: string) {
  const u = usuario(db, usuarioId);
  const p = db.catalogo.find(x => x.id === productoId);
  if (!u || !p) throw new Error('Datos no válidos.');
  if (u.puntos < p.costoPuntos) throw new Error(`Puntos insuficientes: tiene ${u.puntos} y necesita ${p.costoPuntos}.`);
  u.puntos -= p.costoPuntos;
  db.movimientos.push({ id: uid('M'), tipo: 'canje', usuarioId: u.id, tiendaId, litros: 0, puntos: -p.costoPuntos, detalle: 'Canje: ' + p.nombre, fecha: new Date().toISOString() });
  save(db);
  return p;
}

export function comprarBoleto(db: DB, usuarioId: string, sorteoId: string) {
  const u = usuario(db, usuarioId);
  const s = db.sorteos.find(x => x.id === sorteoId);
  if (!u || !s) throw new Error('Datos no válidos.');
  if (s.ganadorId) throw new Error('Este sorteo ya se realizó.');
  if (u.puntos < s.costoBoleto) throw new Error(`Necesitas ${s.costoBoleto} puntos para un boleto.`);
  u.puntos -= s.costoBoleto;
  s.boletos.push(u.id);
  db.movimientos.push({ id: uid('M'), tipo: 'sorteo', usuarioId: u.id, tiendaId: null, litros: 0, puntos: -s.costoBoleto, detalle: 'Boleto: ' + s.premio, fecha: new Date().toISOString() });
  save(db);
}

export function realizarSorteo(db: DB, sorteoId: string) {
  const s = db.sorteos.find(x => x.id === sorteoId);
  if (!s || !s.boletos.length) throw new Error('El sorteo no tiene boletos.');
  s.ganadorId = s.boletos[Math.floor(Math.random() * s.boletos.length)];
  save(db);
  return usuario(db, s.ganadorId)!;
}

export function nuevoCliente(db: DB, p: { nombre: string; telefono: string; tiendaId: string; tarjetaFisica: boolean }) {
  if (!p.nombre.trim()) throw new Error('Escribe el nombre del cliente.');
  let codigo: string;
  do { codigo = 'GQS-' + Math.floor(1000 + Math.random() * 9000); } while (porCodigo(db, codigo));
  const u: Usuario = { id: uid('U'), nombre: p.nombre.trim(), codigo, telefono: p.telefono.trim(), puntos: 0, tiendaId: p.tiendaId, tarjetaFisica: p.tarjetaFisica, quizHecho: false };
  db.usuarios.push(u);
  save(db);
  return u;
}

export function solicitarRecoleccion(db: DB, tiendaId: string) {
  const t = tienda(db, tiendaId);
  if (t) { t.recoleccionSolicitada = true; save(db); }
}

export function marcarRecolectada(db: DB, tiendaId: string) {
  const t = tienda(db, tiendaId);
  if (!t) return;
  const pagoUSD = +(t.litrosBidon * db.reglas.pagoTiendaPorLitroUSD).toFixed(2);
  db.recolecciones.push({ id: uid('R'), tiendaId, litros: t.litrosBidon, pagoUSD, fecha: new Date().toISOString() });
  t.litrosBidon = 0;
  t.recoleccionSolicitada = false;
  save(db);
  return pagoUSD;
}

export function completarQuiz(db: DB, usuarioId: string) {
  const u = usuario(db, usuarioId);
  if (!u || u.quizHecho) return 0;
  u.quizHecho = true;
  u.puntos += db.reglas.puntosQuiz;
  db.movimientos.push({ id: uid('M'), tipo: 'quiz', usuarioId: u.id, tiendaId: null, litros: 0, puntos: db.reglas.puntosQuiz, detalle: 'Quiz «Aprende» completado', fecha: new Date().toISOString() });
  save(db);
  return db.reglas.puntosQuiz;
}

// ---------- Formato ----------
export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-SV', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtNum = (n: number) => n.toLocaleString('es-SV', { maximumFractionDigits: 1 });
