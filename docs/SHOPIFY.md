# La app de Mikro para Shopify

> Estado: **base construida, sin credenciales**. El código está completo y probado
> en lo que se puede probar sin Shopify. No funcionará hasta que exista la app en
> el Partner Dashboard y sus claves estén en el entorno.

## Qué resuelve

Una pyme con tienda en Shopify que contrata a un creador no sabe si ha vendido algo
gracias a él. Mira las visitas, mira el feed, y decide por intuición. Esta app
responde la única pregunta que importa: **de los pedidos de esta semana, cuáles los
trajo cada colaboración**.

Tres cosas, en este orden:

1. Ver las campañas de Mikro sin salir del admin de Shopify.
2. Dar a cada creador su código de descuento con un clic.
3. Contar las ventas reales que entra cada código.

## Cómo se atribuye una venta

**Por código de descuento, no por enlace.** Cada creador de una campaña recibe uno
propio (`MIKRO-MARTA-7F3K`). Cuando entra un pedido con ese código, la venta es de esa
colaboración.

Es la decisión de diseño más importante de la integración, y va contra lo habitual:

- Un código funciona en un reel, en una story y dicho en voz alta. Un enlace con UTM
  solo funciona si el seguidor pincha.
- No depende de cookies ni de que la compra ocurra en el mismo dispositivo donde se vio
  el contenido, que es justo lo que falla en Instagram.
- El creador puede decirlo en cámara, y eso ya es parte del anuncio.
- Da al seguidor un motivo para comprar ahora.

Lo que pierde: las ventas sin código no se atribuyen, y alguien puede usar un código que
no vio en el creador. Se prefiere **contar de menos a contar de más**: un panel que
infla resultados no sirve para decidir con quién repetir.

## Arquitectura

Vive dentro del despliegue que ya existe. Ni repositorio ni hosting aparte:

```
backend/src/shopify/
  config.js      versión de API, permisos, validación de dominios
  verify.js      firmas HMAC y tokens de sesión  ← el punto crítico
  tokens.js      canje y refresco de tokens de acceso
  admin.js       cliente GraphQL de la Admin API
  discounts.js   creación y baja de códigos
  webhooks.js    alta de suscripciones
backend/src/routes/
  shopify.js          API de la app incrustada  → /api/shopify
  shopifyWebhooks.js  recepción de webhooks     → /api/shopify/webhooks
frontend/src/pages/ShopifyApp.jsx    la interfaz  → /shopify
```

### Cuatro detalles que no son opcionales

**El cuerpo en crudo.** El router de webhooks se monta en `app.js` *antes* del
`express.json()` general. La firma se calcula sobre los bytes tal como llegan; en cuanto
un parser los interpreta y los vuelve a serializar, cambian espacios y orden y la firma
deja de cuadrar. Si alguien invierte ese orden, la app deja de recibir ventas y **no da
ningún error**. Hay una prueba que lo vigila.

**Comparar firmas en tiempo constante.** `===` sale del bucle en el primer byte distinto,
y esa diferencia de microsegundos permite adivinar la firma byte a byte. Se usa
`crypto.timingSafeEqual`, previa comprobación de longitud porque si no, revienta.

**Verificar el token de sesión entero.** Comprobar la firma no basta: un token legítimo
de otra app o de otra tienda también la tiene válida. Se comprueba además `aud` (que
venga dirigido a esta app) y que `iss` y `dest` hablen de la misma tienda.

**Idempotencia.** Shopify entrega *al menos una vez*, no *exactamente una vez*. Cada
webhook se registra por su `X-Shopify-Webhook-Id` y un reintento se descarta. Sin esto,
un reintento sumaría dos veces la misma venta.

### Tokens

Shopify ya no admite tokens offline perpetuos para la Admin API en apps públicas nuevas,
y las existentes los pierden el 1 de enero de 2027. Se usan **tokens con caducidad**: una
hora de vida más uno de refresco de 90 días. Todo pasa por `accessTokenFor()`, que renueva
cuando quedan menos de cinco minutos. Si el refresco también ha caducado —una tienda que
lleva tres meses sin abrir la app— devuelve `null` y la tienda tiene que volver a entrar.

### Versión de la API

Fijada a `2026-10` en `config.js`. No se usa `latest` ni `unstable`: Shopify publica una
estable cada trimestre y mantiene cada una doce meses, así que subirla debe ser una
decisión con su commit y su prueba.

## Puesta en marcha

Lo que hace falta y **solo puede hacer el dueño de la cuenta**:

1. **Cuenta de Shopify Partners** (gratis) y una **tienda de desarrollo**.
2. Crear la app en el Partner Dashboard y copiar `Client ID` y `Client secret`.
3. Variables de entorno, en local (`.env`) y en Netlify:

   ```
   SHOPIFY_API_KEY="..."            # Client ID
   SHOPIFY_API_SECRET="..."         # Client secret
   SHOPIFY_APP_URL="https://mikro-marketplace.netlify.app"
   VITE_SHOPIFY_API_KEY="..."       # el mismo Client ID; es público
   ```

4. Subir la configuración: `shopify app config push` con el `shopify.app.toml` del
   repositorio. Ahí están declarados los permisos y los tres webhooks de cumplimiento.
5. En desarrollo hace falta un túnel (`cloudflared`, `ngrok`): Shopify tiene que poder
   alcanzar los webhooks, y `localhost` no le vale. `SHOPIFY_APP_URL` debe apuntar al
   túnel mientras se desarrolla.

Sin los pasos 1 y 2, `/api/shopify/*` responde «la app de Shopify no está configurada» y
el resto de Mikro funciona exactamente igual.

## Pruebas

```bash
npm run test:shopify
```

35 comprobaciones, sin red ni base de datos: firmas válidas e inválidas, cuerpos
manipulados, firmas de longitud distinta (que harían estallar `timingSafeEqual`), tokens
de otra app, de otra tienda, caducados, manipulados y con `alg:none`, dominios de tienda
falsificados, formato y unicidad de los códigos, y las rutas de webhook respondiendo 401
a una firma inválida.

Lo que **no** cubren, porque hace falta una tienda de verdad: el canje de tokens, la
creación del descuento en Shopify y la llegada de un pedido real.

### Validación contra el esquema real

Todas las operaciones de GraphQL están comprobadas contra el esquema de la Admin API
con el validador del conector de Shopify. Encontró cinco cosas que habrían fallado en
producción y que ninguna prueba propia podía detectar:

| Lo que tenía | Lo correcto |
|---|---|
| `WebhookSubscription.endpoint { callbackUrl }` | `uri` |
| `WebhookSubscriptionInput.callbackUrl: URL!` | `uri: String!` (admite `pubsub://` y ARN de EventBridge, por eso no es `URL`) |
| `DiscountCodeBasicInput.customerSelection: { all: true }` | `context: { all: ALL }`, y `all` es un enum, no un booleano |
| `Shop.billingAddress` | `shopAddress` |
| `ShopPlan.displayName` | `publicDisplayName` |

El validador también reveló que `discountCodeBasicCreate` necesita `read_discounts`
además de `write_discounts`. Faltaba en los permisos declarados: la app habría instalado
bien y fallado al crear el primer código.

Al cambiar de versión de API, lo primero es volver a pasar el validador.

## Estado real (probado contra una tienda de desarrollo)

App `Mikro`, id `434025889793`, organización Auttask. Tienda de pruebas:
`mikro-tienda-de-pruebas.myshopify.com`.

Funciona de punta a punta:

- Instalación gestionada (`use_legacy_install_flow = false`).
- App Bridge y token de sesión dentro del admin.
- **Canje de token**: devuelve un token `shpua_` con caducidad a una hora y su
  token de refresco, guardados en `ShopifyShop`.
- **Admin API**: la consulta de tienda trae nombre, moneda, plan y país.
- **Códigos de descuento**: creado uno real (`MIKRO-MARTAGARCI-0K5K`, 10%,
  estado `ACTIVE`), verificado en la tienda y desactivado después. El flujo
  completo de `discounts.js` queda probado.
- Webhook `app/uninstalled` suscrito.

### Lo que está bloqueado: webhooks de pedidos

`orders/create` y `orders/paid` **no se pueden suscribir todavía**:

> This app is not approved to subscribe to webhook topics containing protected
> customer data.

Los datos de pedidos son datos protegidos de cliente, y Shopify exige aprobación
previa. Se solicita en Partners → la app → *Solicitudes de acceso a la API* →
*Acceso a datos de cliente protegidos*.

**Esto bloquea la atribución de ventas**, que es la razón de ser de la app: los
códigos se crean, pero sin el webhook no llega ningún pedido que atribuir. El
código que los recibe está escrito y probado contra firmas; lo que falta es el
permiso.

Una nota sobre el diseño: la app no pide `read_customers` ni guarda nada del
comprador —solo importe, moneda y código del pedido—, lo cual debería facilitar
la solicitud.

## Pendiente

- Probar el ciclo completo contra una tienda de desarrollo. El conector de Shopify
  permitirá crear un descuento real y comprobar la forma de `discount_codes` en un
  pedido de verdad, en cuanto esté autenticado.
- Crear la app en el Partner Dashboard. **No se puede hacer por API con el conector
  disponible**: este habla con una tienda (Admin API), y las apps se crean en el Partner
  Dashboard. Hay que hacerlo a mano.
- Asignar creador a cada código desde la interfaz: ahora se crea uno por campaña y el
  creador se asocia por API, pero la pantalla todavía no deja elegirlo.
- Enlace con UTM como apoyo del código: el modelo ya guarda `landingUrl`.
- Devolver las ventas atribuidas al panel de Mikro, no solo al de Shopify.
- Reembolsos: un pedido devuelto sigue contando como venta. Hace falta
  `refunds/create` para descontarlo.
- Facturación por la App Store si algún día la app deja de ser gratuita.
