# Gota que Suma

App demostrativa (Rally Latinoamericano de Innovación 2026 · UPED) para reciclar aceite de cocina usado: los hogares lo llevan a la tienda del barrio, ganan puntos y lo canjean por productos o boletos de sorteos. Una recicladora lo recolecta para biodiésel.

## Cómo correrla

```bash
npm install
npm run dev
```

Abre http://localhost:4321. Para publicarla como sitio estático: `npm run build` (sale en `dist/`).

## Vistas

| Ruta | Rol | Qué hace |
|---|---|---|
| `/ciudadano` | Ciudadano | Puntos, código QR, impacto, canjes, sorteos y tiendas cercanas |
| `/tienda` | Tienda | Recibir aceite (con revisión de calidad y límite diario), canjear, registrar clientes, **tarjeta de sellos en PDF**, pedir recolección |
| `/recicladora` | Recicladora | Panel de impacto, recolecciones pendientes, ranking, sorteos, reglas y respaldo JSON |
| `/aprende` | Todos | Información y quiz que da puntos |

## Datos

- `src/data/seed.json`: datos de ejemplo y **reglas del programa** (puntos por litro, límites, etc.).
- Al abrir la app, la semilla se copia a `localStorage`; todo lo que hagas queda en ese navegador.
- "Reiniciar datos" vuelve a la semilla. En Recicladora → Ajustes puedes exportar e importar el JSON.

## Tarjeta de papel

Para personas que no usan la app: la tienda las registra y descarga un PDF con su código, un QR y 20 casillas (1 casilla = 1 litro). Al recibir aceite, la app le dice a la tienda qué casillas debe sellar o firmar. Los litros ya registrados salen marcados al reimprimir la tarjeta.
