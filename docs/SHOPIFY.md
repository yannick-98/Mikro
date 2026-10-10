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

### Atribución de ventas: probada en producción

Desbloqueada. La clave: el **paso 1** del formulario de datos protegidos
(Partners → la app → *Solicitudes de acceso a la API*) ya da acceso en
desarrollo con solo seleccionar el uso; la revisión formal solo la exige la App
Store. Declarado **«Informes y estadísticas»**, y los campos opcionales de
nombre, correo, teléfono y dirección **sin marcar**, porque la app no los usa.

Con eso, `ORDERS_CREATE` y `ORDERS_PAID` se suscriben sin problema.

Comprobado contra producción:

| Qué | Resultado |
|---|---|
| Pedido real sin código de Mikro | Los dos webhooks llegan, pasan la firma, no atribuyen nada |
| Pedido con código | Atribuido: 1 pedido, 84,85 USD a la campaña y a la creadora |
| Mismo webhook dos veces | El segundo se descarta por id |
| Mismo pedido por `orders/create` y `orders/paid` | Cuenta una sola vez |
| Panel del comerciante | Muestra la venta en la moneda de la tienda |

Cerrado con compras reales por la tienda online, no con payloads fabricados.
La prueba que vale es esta, con tres pedidos reales en la misma tienda:

| Pedido | Importe | Código | Atribuido |
|---|---|---|---|
| `#1001` | 84,85 USD | ninguno | No |
| `#1002` | 729,95 USD | ninguno | No |
| `#1003` | 637,46 USD | `MIKRO-MARTAGARCI-T23RB` | **Sí** → Reto 21 días · Marta García |

Que dos pedidos reales con dinero de por medio **no** se atribuyan es tan
importante como que el tercero sí: significa que el panel no se infla con
ventas que la campaña no trajo.

### Dos cosas que salieron de probarlo con las manos

**El límite por cliente.** Los códigos se creaban con
`appliesOncePerCustomer: true`, razonando que nadie debía abastecerse para el
año. Un código así **no se puede aplicar a un pedido creado desde el admin** y
obliga a identificar al comprador. Es una restricción que la tienda no pidió:
ahora es opcional y por defecto no se aplica.

**La moneda.** El panel mostraba «85 €» para una venta de 84,85 USD: el
formateador estaba fijado a euros y además redondeaba. Mikro cobra en euros,
pero la tienda vende en la suya. Ahora cada importe se muestra en la moneda de
la tienda y con sus céntimos.

### Nota sobre el buscador de descuentos del admin

Al aplicar un código a un pedido desde el admin, el buscador va **por título**,
no por código. Por eso conviene que el título diga algo reconocible: se genera
como `Mikro · <campaña> · <creador>`.

### Lo que estaba bloqueado: webhooks de pedidos

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

## Devoluciones

Un pedido devuelto ya no cuenta como venta. La app se suscribe a
`refunds/create` y **resta lo devuelto, pero no lo borra**: `salesTotal` sigue
siendo el bruto y `refundedTotal` guarda aparte lo reintegrado. Restarlo sin
más escondería que hubo una venta y una devolución, y eso no es lo mismo que
no haber vendido.

El importe sale de las transacciones efectivamente devueltas, no de las líneas
del pedido: las líneas dicen qué se devolvió, no cuánto dinero salió de caja.

Probado con una devolución parcial real sobre el pedido `#1003`:

| | |
|---|---|
| Venta bruta | 637,46 USD |
| Devuelto | 200,00 USD |
| **Neto en el panel** | **437,46 USD** |

Y el reenvío del mismo reembolso con otro id de webhook no vuelve a restar: la
tabla `ShopifyRefund` tiene clave única por devolución, igual que los pedidos
la tienen por `orderGid`.

## Crear un código desde la interfaz

El formulario de cada campaña pide tres cosas:

- **Creador.** Se ofrecen quienes ya colaboran y quienes se han postulado, en
  ese orden. Dar a elegir entre todo el catálogo no ayudaría: el código es para
  quien va a publicar algo.
- **Descuento**, del 1 al 60 %.
- **Código.** Se propone a partir del creador elegido y cambia solo mientras
  nadie lo escriba a mano; en cuanto se toca, manda lo que escriba la tienda.
  Se normaliza en vivo (mayúsculas, sin acentos, solo letras, números y
  guiones) porque un código con un espacio es una venta que nadie atribuye.

Dos códigos iguales en la misma tienda se rechazan: el webhook no sabría a cuál
de las dos colaboraciones apuntar la venta.

## La pantalla de configuración

La app tiene dos pantallas, y Shopify las pinta en **su propia barra lateral**
mediante `<ui-nav-menu>`: *Panel* y *Configuración*. No se monta una navegación
propia dentro del iframe, que competiría con la del admin.

Eso obliga a servir también las subrutas: `/shopify/*` va a la misma entrada
HTML, con su cabecera `frame-ancestors`.

Qué hay en Configuración:

- **Cuenta de Mikro** y el botón de desvincular, con aviso de qué se conserva.
- **Cómo se crean tus códigos**: prefijo, descuento por defecto y si limitar a
  un uso por cliente. Se guardan por tienda, porque cada marca tiene su
  convención y la nuestra no tiene por qué ser la suya.
- **Tus códigos**, con su estado y sus ventas, y la opción de retirarlos.
  Retirar desactiva el código en la tienda pero conserva el histórico.
- **Conexión con Shopify**: estado real de cada suscripción, consultado en
  vivo, con un botón para volver a suscribir lo que se haya caído. Si una se
  cae dejaríamos de contar ventas sin avisar, así que la tienda tiene derecho
  a verlo. Además, versión de API, permisos concedidos y caducidad del acceso.
- **Qué datos guardamos**, en dos párrafos y sin rodeos, con enlace a la
  política de privacidad.

Dos endpoints que ya existían (`/unlink` y retirar un código) no tenían
interfaz. Esta pantalla es su sitio.

## Las ventas en el panel de Mikro

No solo en Shopify:

- **Empresa:** las ventas atribuidas aparecen en su panel. Es la única cifra
  que mide dinero que entra, no que sale.
- **Creador:** ve lo que han vendido sus códigos, desglosado por campaña. Para
  un creador eso no es una métrica más: es el argumento con el que pedir más
  en la siguiente colaboración.

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
- Facturación por la App Store si algún día la app deja de ser gratuita.
