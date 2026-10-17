import { icon } from './icons';
import type { Movimiento } from './store';
import { fmtFecha, fmtNum } from './store';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// ---------- Navegación inferior por vistas ----------
export function initTabs(onChange?: (view: string) => void) {
  const go = (view: string) => {
    $$('[data-view]').forEach(s => s.classList.toggle('hidden', s.dataset.view !== view));
    $$('[data-nav]').forEach(b => b.classList.toggle('is-active', b.dataset.nav === view));
    history.replaceState(null, '', '#' + view);
    window.scrollTo({ top: 0 });
    onChange?.(view);
  };
  document.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
    if (b) { e.preventDefault(); go(b.dataset.nav!); }
  });
  const first = $$('[data-view]')[0]?.dataset.view ?? '';
  const fromHash = location.hash.slice(1);
  go($$('[data-view]').some(s => s.dataset.view === fromHash) ? fromHash : first);
  return go;
}

// ---------- Hojas inferiores (bottom sheets) con <dialog> ----------
export function openSheet(id: string) {
  const d = document.getElementById(id) as HTMLDialogElement;
  d.showModal();
}
export function closeSheet(id: string) {
  (document.getElementById(id) as HTMLDialogElement).close();
}
document.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const closer = t.closest<HTMLElement>('[data-close]');
  if (closer) closer.closest('dialog')?.close();
  // Clic en el fondo cierra la hoja
  if (t instanceof HTMLDialogElement) t.close();
  const opener = t.closest<HTMLElement>('[data-open]');
  if (opener) openSheet(opener.dataset.open!);
});

// ---------- Avisos ----------
export function toast(msg: string, kind: 'ok' | 'error' = 'ok') {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[100] flex flex-col gap-2 w-[min(92vw,400px)] pointer-events-none';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind === 'error' ? 'bg-red-600' : 'bg-plum-900'} text-white text-sm font-semibold rounded-2xl px-4 py-3 shadow-xl flex items-center gap-2`;
  el.innerHTML = icon(kind === 'error' ? 'x' : 'check', 'w-5 h-5 shrink-0') + `<span>${esc(msg)}</span>`;
  box.append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 2800);
  setTimeout(() => el.remove(), 3200);
}

/** Ejecuta una acción y muestra el error como aviso si falla. */
export function intentar<T>(fn: () => T): T | undefined {
  try { return fn(); } catch (err) { toast((err as Error).message, 'error'); }
}

// ---------- Fila de movimiento ----------
const MOV: Record<string, { i: string; c: string }> = {
  entrega: { i: 'drop', c: 'bg-amber-100 text-amber-700' },
  rechazo: { i: 'x', c: 'bg-red-100 text-red-600' },
  canje: { i: 'gift', c: 'bg-magenta-100 text-magenta-600' },
  sorteo: { i: 'ticket', c: 'bg-violet-100 text-violet-700' },
  quiz: { i: 'book', c: 'bg-emerald-100 text-emerald-700' },
};

export function movRow(m: Movimiento, subtitulo = '') {
  const s = MOV[m.tipo];
  const signo = m.puntos > 0 ? '+' : '';
  const color = m.puntos > 0 ? 'text-emerald-600' : m.puntos < 0 ? 'text-plum-900' : 'text-gray-400';
  return `<li class="flex items-center gap-3 py-3">
    <span class="grid place-items-center w-10 h-10 rounded-full ${s.c} shrink-0">${icon(s.i)}</span>
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-sm text-plum-950 truncate">${esc(m.detalle)}${m.litros && m.tipo !== 'canje' ? ` · ${fmtNum(m.litros)} L` : ''}</p>
      <p class="text-xs text-gray-500 truncate">${esc(subtitulo || fmtFecha(m.fecha))}</p>
    </div>
    <span class="font-bold text-sm ${color} tabular-nums">${m.puntos ? signo + m.puntos + ' pts' : '0 pts'}</span>
  </li>`;
}

export const vacio = (txt: string) => `<li class="py-8 text-center text-sm text-gray-400">${esc(txt)}</li>`;
