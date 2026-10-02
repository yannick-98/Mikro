# API de Mikro

Base: `http://localhost:4000/api`

Autenticación por **JWT** en la cabecera `Authorization: Bearer <token>`.
Los errores se devuelven como `{ "error": "mensaje", "details": [...] }` con el código
HTTP correspondiente (400 validación, 401 sin sesión, 403 sin permiso, 404 no existe,
409 conflicto).

Roles: `BRAND` (empresa), `CREATOR` (creador), `ADMIN`.

---

## Sesión

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/register` | — | Alta. `{ email, password, name, role, ... }` según rol. Devuelve `{ token, user }`. |
| POST | `/auth/login` | — | Inicio de sesión. Devuelve `{ token, user }`. |
| GET | `/auth/me` | cualquiera | Usuario de la sesión actual. |
| PATCH | `/auth/me` | cualquiera | Cambia nombre y avatar. |

---

## Descubrir creadores

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/creators` | público | Listado con filtros y afinidad. |
| GET | `/creators/:handle` | público | Ficha completa, valoraciones y perfiles similares. |

**Parámetros de `/creators`**

| Parámetro | Ejemplo | Efecto |
|---|---|---|
| `q` | `vegano` | Texto libre sobre nombre, titular, bio y temas. |
| `categories` | `Fitness,Moda` | Filtro duro por categoría. |
| `cities` | `Madrid,Valencia` | Filtro duro por ciudad. |
| `platforms` | `instagram,tiktok` | Debe tener al menos una. |
| `minFollowers` / `maxFollowers` | `10000` / `50000` | Rango de audiencia. |
| `minEngagement` | `4` | Engagement mínimo en %. |
| `maxBudget` | `300` | Compara con la tarifa publicada. |
| `language` | `Espanol` | Idioma del creador. |
| `audienceCountry` | `Espana` | País principal de la audiencia. |
| `tab` | `top` \| `rising` \| `new` | Pestaña de la portada. |
| `sort` | `relevance` \| `followers` \| `engagement` \| `rating` \| `price` \| `score` | Orden. |
| `page`, `pageSize` | `1`, `12` | Paginación (máx. 48). |

Respuesta: `{ items, total, page, pageSize, pages }`. Cada elemento incluye `match`
(0–100) calculado contra los criterios enviados.

---

## Búsqueda en lenguaje natural

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/search/ai` | público | `{ query }` → `{ filters, interpretation, items, total }`. |
| GET | `/search/facets` | público | Categorías (con foto), ciudades, plataformas, tramos, idiomas. |
| GET | `/search/examples` | público | Consultas de ejemplo para la interfaz. |

`interpretation` es la lista legible de lo que se ha deducido de la frase; la interfaz
la muestra como chips para que el usuario entienda por qué ve esos resultados.

---

## Rankings

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/rankings?scope=global\|category\|city\|platform&value=&limit=` | público | Ranking filtrado. |
| GET | `/rankings/movers?limit=` | público | Mayores subidas y bajadas de la semana. |
| GET | `/rankings/collections` | público | Top por categoría y recuento por ciudad. |
| GET | `/stats/home` | público | Cifras de la portada. |

---

## Perfil del creador

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/creators/me` | CREATOR | Su propio perfil. |
| PATCH | `/creators/me` | CREATOR | Datos, tarifas, audiencia, disponibilidad. |
| PUT | `/creators/me/social` | CREATOR | Alta o actualización de una red. Recalcula métricas. |
| DELETE | `/creators/me/social/:platform` | CREATOR | Desconecta una red. |
| POST | `/creators/me/portfolio` | CREATOR | Añade una pieza. |
| DELETE | `/creators/me/portfolio/:id` | CREATOR | Elimina una pieza. |
| GET | `/creator/dashboard` | CREATOR | Ingresos, ranking, actividad y completitud del perfil. |

---

## Empresa

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/brands/me` | BRAND | Datos de la empresa. |
| PATCH | `/brands/me` | BRAND | Actualiza los datos. |
| GET | `/brands/me/dashboard` | BRAND | Resumen de campañas, candidaturas, gasto y alcance. |
| GET | `/brands/me/saved` | BRAND | Creadores guardados. |
| POST | `/brands/me/saved/:creatorId` | BRAND | Alterna guardado. Devuelve `{ saved }`. |

---

## Campañas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/campaigns` | público / sesión | Campañas abiertas. Con `?mine=true` las propias de la empresa. Si hay sesión de creador, añade `match` y `applied`. |
| GET | `/campaigns/:id` | público | Ficha. Si eres la empresa propietaria, incluye las candidaturas. |
| POST | `/campaigns` | BRAND | Crea una campaña. |
| PATCH | `/campaigns/:id` | BRAND | Modifica o cambia el estado. |
| DELETE | `/campaigns/:id` | BRAND | Elimina la campaña y sus candidaturas. |
| GET | `/campaigns/:id/recommended` | BRAND | Creadores con mayor afinidad que aún no se han postulado. |
| POST | `/campaigns/:id/invite` | BRAND | Invita a un creador: `{ creatorId, fee, message }`. |

---

## Candidaturas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/applications` | BRAND / CREATOR | Las recibidas o las enviadas, según el rol. |
| POST | `/applications` | CREATOR | Postularse: `{ campaignId, proposedFee, message }`. |
| POST | `/applications/:id/accept` | BRAND | Acepta y **crea la colaboración**. |
| POST | `/applications/:id/reject` | BRAND | Descarta la candidatura. |
| POST | `/applications/:id/confirm` | CREATOR | Acepta una invitación de marca y crea la colaboración. |
| POST | `/applications/:id/withdraw` | CREATOR | Retira su candidatura. |

---

## Colaboraciones

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/deals` | BRAND / CREATOR | Sus colaboraciones. |
| GET | `/deals/:id` | participante | Detalle con los mensajes. |
| POST | `/deals/:id/messages` | participante | Envía un mensaje. |
| POST | `/deals/:id/review` | BRAND | Valora al creador (1–5). Solo con la colaboración aprobada o pagada. |
| POST | `/deals/:id/:accion` | según acción | Transición de estado. |

**Ciclo de vida**

```
ACCEPTED ──fund(empresa)──> FUNDED ──start(creador)──> IN_PROGRESS
   │                           │                            │
   │                           └────────submit(creador)──────┤
   │                                                         ▼
   │                                                    SUBMITTED
   │                                                         │
   │                                          approve(empresa)│
   │                                                         ▼
   │                                                    APPROVED
   │                                          release(empresa)│
   │                                                         ▼
   └──cancel(cualquiera, antes de entregar)──> CANCELLED    PAID
```

- `fund` genera un movimiento `ESCROW_IN` por el importe completo.
- `submit` exige `{ contentUrl }`.
- `release` genera un `PAYOUT` por el neto (importe menos comisión) y recalcula las
  métricas del creador.
- `cancel` genera un `REFUND` si ya había fondos depositados.

Cada transición comprueba tanto el **rol que la ejecuta** como el **estado de partida**;
una acción fuera de orden devuelve 400 y una ejecutada por quien no corresponde, 403.

---

## Avisos y backoffice

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/notifications` | cualquiera | Últimos 30 avisos y número de no leídos. |
| POST | `/notifications/read` | cualquiera | Marca todos como leídos. |
| GET | `/admin/overview` | ADMIN | Métricas de la plataforma y perfiles por verificar. |
| POST | `/admin/creators/:id/verify` | ADMIN | Verifica un perfil. |
| POST | `/admin/creators/:id/feature` | ADMIN | Destaca un perfil. |
| POST | `/admin/ranking/recompute` | ADMIN | Recalcula posiciones y movimientos. |

---

## Peticiones de demo

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/demo-requests` | público | Alta de una petición desde la landing. Si el mismo email ya tiene una petición `NEW` de las últimas 24 h, se actualiza en vez de duplicarse (devuelve 200 con `updated: true` en lugar de 201). |
| GET | `/demo-requests` | ADMIN | Bandeja de leads. Acepta `status` y `limit`; devuelve también `pending`, el número de peticiones sin atender. |
| PATCH | `/demo-requests/:id` | ADMIN | Cambia `status` (`NEW`, `CONTACTED`, `SCHEDULED`, `WON`, `LOST`) y las notas internas. |

Cuerpo del POST: `companyName`, `contactName`, `email` y `consent: true` son
obligatorios. Opcionales: `phone`, `website`, `sector`, `city`, `teamSize`
(`1-5`, `6-20`, `21-50`, `50+`), `monthlyBudget` (`menos-300`, `300-800`,
`800-2000`, `mas-2000`, `por-decidir`) y `goal`.

`consent` no es decorativo: se guarda como `consentAt` y es lo que legitima la
llamada posterior. Sin él la petición se rechaza con 400.

Cada alta nueva genera un aviso `DEMO_REQUEST` para los usuarios ADMIN.
