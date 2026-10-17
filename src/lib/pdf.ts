import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Usuario, Tienda, Reglas } from './store';

const PLUM: [number, number, number] = [42, 11, 61];
const MAGENTA: [number, number, number] = [226, 32, 140];
const GOLD: [number, number, number] = [255, 196, 0];
const GRIS: [number, number, number] = [110, 110, 120];

/**
 * Tarjeta de sellos en PDF (tamaño carta) para clientes que no usan la app.
 * La tienda sella o firma una casilla por cada litro recibido.
 * `sellosPrevios` marca como "registrado" los litros que ya están en el sistema.
 */
export async function tarjetaPDF(u: Usuario, t: Tienda | undefined, reglas: Reglas, sellosPrevios = 0) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const M = 15;

  // Encabezado
  doc.setFillColor(...PLUM);
  doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 36, W, 2.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Gota que Suma', M, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Tarjeta de sellos · Reciclaje de aceite de cocina usado', M, 25);
  doc.setFontSize(9);
  doc.text('Tu aceite no va al drenaje: se convierte en biodiésel y en puntos para tu familia.', M, 31);

  // Datos del cliente
  const y0 = 46;
  doc.setDrawColor(220, 220, 228);
  doc.setFillColor(248, 246, 251);
  doc.roundedRect(M, y0, W - 2 * M, 48, 3, 3, 'FD');

  const etiqueta = (txt: string, x: number, y: number) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(txt.toUpperCase(), x, y);
  };
  const valor = (txt: string, x: number, y: number, size = 12) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(30, 20, 40); doc.text(txt, x, y);
  };

  etiqueta('Nombre', M + 6, y0 + 9);
  valor(u.nombre, M + 6, y0 + 16, 14);
  etiqueta('Código de cliente', M + 6, y0 + 26);
  doc.setFont('courier', 'bold'); doc.setFontSize(20); doc.setTextColor(...MAGENTA);
  doc.text(u.codigo, M + 6, y0 + 35);
  etiqueta('Punto de acopio', M + 80, y0 + 26);
  valor(t ? t.nombre : '—', M + 80, y0 + 32, 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  if (t) doc.text(`${t.direccion}, ${t.zona}`, M + 80, y0 + 37);
  etiqueta('Teléfono', M + 6, y0 + 43);
  valor(u.telefono || '—', M + 28, y0 + 43, 9);
  etiqueta('Emitida', M + 80, y0 + 43);
  valor(new Date().toLocaleDateString('es-SV'), M + 98, y0 + 43, 9);

  const qr = await QRCode.toDataURL(u.codigo, { margin: 1, width: 300, color: { dark: '#2a0b3d', light: '#ffffff' } });
  doc.addImage(qr, 'PNG', W - M - 42, y0 + 4, 38, 38);
  doc.setFontSize(7); doc.setTextColor(...GRIS);
  doc.text('Muestra este código en la tienda', W - M - 23, y0 + 45.5, { align: 'center' });

  // Regla
  const yr = y0 + 54;
  doc.setFillColor(...GOLD);
  doc.roundedRect(M, yr, W - 2 * M, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PLUM);
  doc.text(`1 casilla = 1 litro de aceite = ${reglas.puntosPorLitro} puntos   ·   Máximo ${reglas.limiteLitrosDiaPorPersona} L por día`, W / 2, yr + 6, { align: 'center' });

  // Casillas
  const cols = 5;
  const total = reglas.casillasTarjeta;
  const rows = Math.ceil(total / cols);
  const gx = M, gy = yr + 14, gap = 3;
  const cw = (W - 2 * M - gap * (cols - 1)) / cols;
  const ch = 27;
  for (let i = 0; i < total; i++) {
    const x = gx + (i % cols) * (cw + gap);
    const y = gy + Math.floor(i / cols) * (ch + gap);
    const previo = i < sellosPrevios;
    doc.setLineDashPattern(previo ? [] : [1.5, 1.2], 0);
    doc.setDrawColor(...(previo ? MAGENTA : [190, 180, 200] as [number, number, number]));
    doc.setFillColor(...(previo ? [252, 232, 244] as [number, number, number] : [255, 255, 255] as [number, number, number]));
    doc.roundedRect(x, y, cw, ch, 2.5, 2.5, 'FD');
    doc.setLineDashPattern([], 0);

    doc.setFillColor(...(previo ? MAGENTA : PLUM));
    doc.circle(x + 5, y + 5, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), x + 5, y + 6.1, { align: 'center' });

    if (previo) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MAGENTA);
      doc.text('REGISTRADO', x + cw / 2, y + 15, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text('en el sistema', x + cw / 2, y + 19, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(170, 160, 180);
      doc.text('SELLO / FIRMA', x + cw / 2, y + 15, { align: 'center' });
      doc.setDrawColor(200, 195, 210);
      doc.line(x + 4, y + ch - 5, x + cw - 4, y + ch - 5);
      doc.text('Fecha', x + 4, y + ch - 1.8);
    }
  }

  // Pie: instrucciones y firma de la tienda
  const yp = gy + rows * (ch + gap) + 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PLUM);
  doc.text('¿Cómo guardo mi aceite?', M, yp + 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 50, 70);
  [
    '1. Deja enfriar el aceite después de cocinar.',
    '2. Cuélalo y guárdalo en una botella plástica con tapa (sin agua ni restos de comida).',
    '3. Llévalo a tu tienda: te sellan una casilla por litro y sumas puntos.',
    '4. Canjea tus puntos por productos o participa en los sorteos.',
  ].forEach((l, i) => doc.text(l, M, yp + 10 + i * 4.6));

  const fx = W - M - 62;
  doc.setDrawColor(190, 180, 200);
  doc.roundedRect(fx, yp, 62, 28, 2, 2, 'S');
  doc.setFontSize(7); doc.setTextColor(...GRIS);
  doc.text('SELLO DE LA TIENDA', fx + 31, yp + 5, { align: 'center' });
  doc.line(fx + 6, yp + 22, fx + 56, yp + 22);
  doc.text('Firma del responsable', fx + 31, yp + 25.5, { align: 'center' });

  doc.setFontSize(7.5); doc.setTextColor(...GRIS);
  doc.text('Tus puntos siempre quedan guardados en el sistema con tu código. Al llenar la tarjeta, la tienda te entrega una nueva.', W / 2, 272, { align: 'center' });
  doc.text('Un litro de aceite en el drenaje puede contaminar hasta 40,000 litros de agua.', W / 2, 276, { align: 'center' });

  doc.save(`tarjeta-${u.codigo}.pdf`);
}
