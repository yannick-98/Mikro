# Mikro

**El marketplace que conecta pymes con micro-influencers.**
Una pyme publica lo que necesita, encuentra creadores de su ciudad y su nicho, acuerda
el precio y paga con el dinero retenido hasta aprobar el contenido. Sin agencias.

MVP completo y desplegado: catálogo y ranking públicos, búsqueda en lenguaje natural,
campañas, candidaturas, ciclo de colaboración con pago en garantía, mensajería,
valoraciones y backoffice.

**Demo en vivo: https://mikro-marketplace.netlify.app**

Se puede entrar con las cuentas de prueba de más abajo. Las 54 pruebas de extremo a
extremo pasan tanto en local como contra el despliegue.

- **Estrategia de negocio:** [`docs/NEGOCIO.md`](docs/NEGOCIO.md)
- **Referencia de la API:** [`docs/API.md`](docs/API.md)

---

## Arrancar en local

Requisitos: Node.js 18 o superior.

```bash
npm run setup
```

Instala las dependencias de los dos proyectos, crea la base de datos SQLite y la
rellena con datos de demostración.

```bash
npm run dev
```

Levanta el API en `http://localhost:4000` y la web en `http://localhost:5173`.

También se pueden lanzar por separado, cada uno en su terminal:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

### Cuentas de prueba

Contraseña para todas: `mikro1234`

| Rol | Email | Qué se ve |
|---|---|---|
| Empresa | `hola@laespiga.es` | Campañas con candidaturas y colaboraciones en curso |
| Empresa | `marketing@impulso.es` | Otra empresa, con datos distintos |
| Creadora | `martagarcia@creador.mikro.es` | Número 1 del ranking |
| Creador | `laurajimenez@creador.mikro.es` | Perfil de gastronomía con colaboraciones |
| Admin | `admin@mikro.es` | Backoffice de verificación y métricas |

### Otros comandos

```bash
npm run seed
```

Regenera los datos de demostración (borra y vuelve a crear todo).

```bash
npm run smoke
```

Prueba de extremo a extremo contra el API en marcha: recorre registro, búsqueda,
campaña, candidatura, ciclo completo de colaboración, pago, valoración y permisos.
Son 54 comprobaciones.

---

## Despliegue

El repositorio está preparado para Netlify: la web se sirve como sitio estático y el
API de Express corre como una función serverless en el mismo dominio, de modo que el
frontend sigue llamando a `/api/...` sin cambios.

| Pieza | Dónde | Configuración |
|---|---|---|
| Web | Netlify (estático) | `frontend/dist`, con redirección SPA a `index.html` |
| API | Netlify Functions | `netlify/functions/api.js` envuelve el mismo Express con `serverless-http` |
| Datos | SQLite sembrada en el build | Se copia a `/tmp` en el arranque en frío de la función |

Todo está en [`netlify.toml`](netlify.toml). El comando de build (`npm run
build:netlify`) genera el cliente de Prisma, crea y siembra la base, y compila la web.

Para volver a desplegar desde local:

```bash
npm run build:netlify && netlify deploy --prod --dir frontend/dist --functions netlify/functions --no-build
```

En Windows conviene parar antes el servidor de desarrollo: mantiene abierto el motor de
Prisma y `prisma generate` no puede reemplazarlo.

**Límite importante de esta demo:** el sistema de ficheros de una función serverless es
efímero. Los cambios que se hagan en la demo pública (nuevas campañas, candidaturas,
colaboraciones) viven mientras dure la instancia de la función y se pierden cuando se
recicla, volviendo a los datos de partida. Es suficiente para enseñar el producto, pero
no es persistencia real.

Para un entorno con datos permanentes hay dos caminos, y ambos tocan un solo punto del
código (el `datasource` de Prisma):

1. **Postgres gestionado** (Neon, Supabase o el Postgres de Netlify): se cambia el
   proveedor en `backend/prisma/schema.prisma` y se define `DATABASE_URL` en las
   variables de entorno del sitio.
2. **Backend en un host con estado** (Render, Railway o un VPS): se despliega
   `backend/` tal cual y se define `VITE_API_URL` en Netlify apuntando a ese dominio.
   El cliente ya contempla esa variable.

## Qué incluye

**Público**
- **Descubrir**: ranking de creadores con filtros por categoría, ciudad, tamaño,
  plataforma, engagement, audiencia e idioma; vista de lista o tarjetas.
- **Búsqueda con IA**: se escribe *"creadores de gastronomía en Valencia con 20k-100k
  seguidores"* y la plataforma deduce los filtros, los muestra y ordena por afinidad.
- **Rankings** global, por categoría, ciudad y plataforma, con los movimientos del día.
- **Perfil del creador**: métricas por red, portfolio, tarifas, audiencia y
  valoraciones de marcas.
- Páginas para empresas, para creadores y de recursos (guías, tarifas de referencia y
  obligaciones legales de la publicidad).

**Empresa**
- Panel con campañas, candidaturas pendientes, gasto y alcance contratado.
- Creación de campañas con brief, presupuesto, entregables y requisitos.
- Candidaturas recibidas con la afinidad de cada perfil, y recomendaciones de Mikro.
- Invitación directa a un creador concreto.
- Colaboraciones: depósito, aprobación, liberación del pago, chat y valoración.
- Creadores guardados y datos de empresa.

**Creador**
- Panel con ingresos cobrados y pendientes, posición en el ranking y completitud del
  perfil.
- Oportunidades ordenadas por afinidad, con candidatura y tarifa propuesta.
- Candidaturas enviadas e invitaciones recibidas.
- Colaboraciones con entrega de contenido y seguimiento del pago.
- Edición de perfil, redes, tarifas, audiencia y portfolio.

**Backoffice**
- Métricas de la plataforma (volumen transaccionado e ingresos por comisión),
  verificación de perfiles, destacados y recálculo del ranking.

---

## Arquitectura

```
Mikro/
├── backend/                 API REST — Node + Express + Prisma + SQLite
│   ├── prisma/
│   │   ├── schema.prisma    Modelo de datos
│   │   └── seed.js          Datos de demostración
│   ├── scripts/smoke.js     Prueba de extremo a extremo
│   └── src/
│       ├── routes/          auth, creators, brands, campaigns,
│       │                    applications, deals, search, rankings, misc
│       ├── services/        scoring, nlq, taxonomy, creatorStats,
│       │                    serialize, notify, media
│       ├── middleware/       auth (JWT) y manejo de errores
│       └── lib/             prisma, auth, http
└── frontend/                React 18 + Vite + Tailwind + React Router
    └── src/
        ├── pages/           públicas, brand/, creator/, Admin
        ├── components/      Layout, CreatorRow, Filters, DealsView, ui
        ├── api/client.js    Cliente HTTP
        └── store/auth.jsx   Sesión
```

### Dos decisiones que conviene conocer

**El ranking premia el engagement, no el tamaño.** En `services/scoring.js`, el
engagement pesa un 34% y el alcance un 20%, además en escala logarítmica. Es la tesis
del producto: para una pyme, un perfil de 20.000 seguidores con comunidad viva vale más
que uno de 500.000 con audiencia fría. El mismo módulo calcula la afinidad (`match`)
entre un creador y unos criterios de búsqueda, con penalización explícita cuando la
categoría no encaja.

**La "búsqueda con IA" es un parser determinista.** `services/nlq.js` interpreta la
frase en español —categoría, ciudad, plataforma, tramo de seguidores, presupuesto,
engagement y audiencia— sin depender de ningún proveedor externo: funciona sin clave de
API, sin coste por consulta y sin latencia. La interfaz muestra siempre lo que ha
entendido, para que el usuario pueda corregirlo. Sustituirlo por un LLM afectaría solo
a ese fichero.

### Sobre los datos

Todos los perfiles, empresas y métricas son ficticios y se generan con un PRNG
reproducible, así que el seed siempre produce el mismo catálogo. Los avatares son SVG
generados en local; las fotos remotas de demostración tienen reserva local, de modo que
la aplicación se ve correctamente incluso sin conexión.

Los pagos están simulados: se registran los movimientos de depósito, abono y devolución
con la comisión aplicada, pero no hay pasarela real. Es el siguiente paso del roadmap.
