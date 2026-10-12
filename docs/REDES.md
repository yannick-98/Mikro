# Datos reales de las redes sociales

> Las cifras de un creador dejan de ser lo que él escribe y pasan a ser lo que
> dicen sus publicaciones.

## Dos caminos

| Camino | Qué hace el creador | Qué hace falta por nuestra parte |
|---|---|---|
| **Por el @** | Escribe su usuario. Nada más. | YouTube: una clave de API (gratis). Instagram y TikTok: un servicio de consulta (de pago) |
| **Autorizando** | Pasa por la pantalla de permisos de la plataforma | App revisada en Meta / TikTok |

El camino normal es el primero, y la razón es de producto, no técnica: un
creador que se registra tiene que salir de Mikro, entrar en Instagram, leer una
pantalla que habla de «acceso a tu contenido» y volver. Ahí se cae gente, y la
que se cae es justo la que todavía no conoce la marca. Autorizar sigue estando
como paso opcional para quien quiera el sello completo de una vez.

### Esto empezó al contrario

Durante un tiempo este documento decía que raspar perfiles públicos era un
error y daba tres razones. Conviene repasarlas una por una, porque dos siguen
en pie y la tercera resultó estar mal.

1. **«Va contra las condiciones de las plataformas.»** Sigue siendo verdad. La
   diferencia es quién lo hace: el servicio de consulta, no nosotros. No es
   una coartada —es una dependencia con un riesgo legal que se asume a
   sabiendas— pero sí es la diferencia entre que nos bloqueen la IP y que se
   la bloqueen a un proveedor que se dedica a eso.
2. **«Se rompe cada semana.»** También. Lo que cambia es que lo arregla el
   proveedor, y que cuando se rompe se ve: queda en `syncError` de la cuenta,
   a la vista del creador, en vez de dejar el ranking decidiéndose en silencio
   con datos viejos.
3. **«Y sobre todo, no comprueba nada: copia el mismo número que ya nos daba
   el creador.»** Esta era la razón de peso y estaba equivocada en la mitad
   importante. Es cierto que un número de seguidores público se puede inflar
   comprando seguidores — pero **eso también pasa autorizando**: la API oficial
   de Instagram devuelve el mismo `followers_count` que ve cualquiera. OAuth
   nunca hizo que los seguidores fueran menos comprables.

   Lo que OAuth daba de verdad eran dos cosas distintas: **prueba de quién es
   la cuenta**, y acceso a **métricas no públicas** (alcance, guardados,
   audiencia). De la segunda nunca llegamos a usar nada: mirando
   `providers/instagram.js`, lo que se pedía era seguidores, likes y
   comentarios, que es exactamente lo que se ve desde fuera. Y la primera se
   resuelve mucho más barato, con un código en la biografía.

Conclusión: por el @ se pierde la puerta abierta a métricas privadas —que
seguirá ahí el día que haga falta, porque el código de OAuth no se ha
tirado— y no se pierde nada de lo que hoy se usa.

## El @ no prueba de quién es la cuenta

Este es el agujero del camino corto y no es menor: **cualquiera puede escribir
el @ de otro**. En un directorio eso sería un dato mal puesto. Aquí una empresa
paga 250 € por llegar a una audiencia, así que es venderle la audiencia de otra
persona y cobrarla.

El arreglo es el mismo truco con el que Google verifica dominios: se le da al
creador un código, lo pega en su biografía y nosotros lo leemos. Ahí solo
escribe quien tiene las llaves. Luego puede quitarlo; lo que queda guardado es
la fecha en la que se comprobó.

```
POST /api/social/instagram/handle    -> trae las cifras (solo las ve él)
GET  /api/social/instagram/propiedad -> el código y dónde pegarlo
POST /api/social/instagram/verificar -> lo busca en la bio
```

**Mientras no esté verificada, la cuenta no sale al escaparate.** Ni en el
perfil público, ni en las búsquedas de las marcas, ni en los agregados del
creador (`cuentaParaElPerfil()`, en `social/propiedad.js`). El creador ve sus
cifras reales desde el primer momento, que es lo que le engancha; lo que no
puede es venderlas todavía.

Autorizando no hace falta: entrar en una cuenta para darnos permiso sobre ella
ya es la prueba. Por eso una cuenta por OAuth queda verificada sola.

Cambiar de @ borra la verificación anterior. Lo comprobado era que la cuenta
vieja era suya, no la nueva.

## Cómo funciona

```
creador da su @  ->  consulta al servicio  ->  métricas recalculadas
                                                  |
                                                  +-> publicaciones guardadas
                                                  +-> foto del momento (histórico)
```

Lo que **no** cambia según el camino: el engagement y la frecuencia los
calculamos nosotros, en `metrics.js`, a partir de las publicaciones reales. El
creador no escribe ninguna cifra en ningún sitio, y la detección de cifras
infladas funciona igual con los datos de una consulta que con los de una
cuenta autorizada.

## El servicio de consulta

Instagram y TikTok no tienen API pública sin autorización, así que van por un
servicio externo. Se elige por variable de entorno y lo que sale está
normalizado, así que cambiarlo es escribir una función en `social/lookup.js` y
no tocar nada más.

```
SOCIAL_LOOKUP_PROVIDER=apify     # si no se pone, se deduce de las credenciales
APIFY_TOKEN=apify_api_...
APIFY_ACTOR_INSTAGRAM=apify~instagram-profile-scraper   # opcional
APIFY_ACTOR_TIKTOK=clockworks~tiktok-scraper            # opcional
```

Sin ninguna credencial, Instagram y TikTok simplemente no ofrecen el camino
del @: la pantalla dice que no está disponible, en vez de un botón que lleva a
un error. YouTube sigue funcionando, porque su API es oficial y gratis.

### Esto se paga por consulta, y eso cambia el diseño

No es una API gratis, y la factura crece con el número de creadores, no con el
uso. De ahí dos decisiones que de otro modo parecerían arbitrarias:

- **Una consulta por sincronización, no dos.** Sincronizar pide el perfil y
  luego las publicaciones, y en estos servicios las dos cosas vienen de la
  misma consulta cobrada. Hay un caché de un minuto en `lookup.js` cuyo único
  trabajo es que esas dos llamadas no se paguen por separado.
- **Tres días en vez de uno.** Las cuentas por @ de Instagram y TikTok se
  refrescan cada 72 h; las demás, cada 24 h. Los seguidores de alguien no
  cambian lo suficiente en un día para pagar por verlo: con mil creadores, la
  diferencia entre un día y tres son dos tercios de la factura por un dato
  que nadie habría notado.

Orden de magnitud para dimensionarlo: mil creadores con dos cuentas cada uno,
refrescadas cada tres días, son unas 20.000 consultas al mes.

## Las cifras se recalculan, no se copian

En `social/metrics.js`, todo puro y cubierto por pruebas. Las decisiones que
importan:

- **Media de razones, no razón de totales.** El engagement es la media de
  `(likes + comentarios) / seguidores` de cada publicación. Si se sumara todo y
  se dividiera una vez, un único vídeo viral taparía una cuenta que
  normalmente no mueve a nadie.
- **Ventana de 90 días y como mucho 12 publicaciones.** Más atrás el perfil ya
  no es el mismo.
- **Las últimas 24 h no cuentan.** Una publicación de hace dos horas sigue
  recogiendo likes; meterla en la media hunde el engagement de quien acaba de
  publicar, que es justo el creador activo que queremos premiar.
- **Menos de tres publicaciones es muestra insuficiente**, y se dice. Un cero
  con aplomo es peor que un «todavía no sabemos».
- **La frecuencia se mide sobre el tiempo que abarcan las publicaciones
  miradas**, no sobre la ventana entera: cinco publicaciones en la última
  semana y nada antes es una frecuencia de cinco, no de cinco entre doce.

### Señales de cifras infladas

Se marcan, no se penalizan solas. Equivocarse aquí le cuesta el sustento a
alguien, así que describen lo que se ve y lo juzga una persona:

- **Likes sin conversación.** En una cuenta real hay del orden de uno o dos
  comentarios por cada cien likes. Muy por debajo es la firma de los likes
  comprados, que vienen sin nadie detrás que escriba.
- **Saltos de seguidores** que ninguna publicación explica.
- **Engagement imposible**: por encima del 20 % sostenido en una cuenta
  mediana casi siempre es grupo de intercambio o cifras hechas a mano.

## Los tokens van cifrados

AES-256-GCM, en `lib/secrets.js`, con la clave en `SECRETS_KEY`. Un token de
Instagram no es un dato del creador: es la llave de su cuenta. Cifrarlo no
arregla una base comprometida, pero separa «se han llevado la base» de «se han
llevado las cuentas de los creadores», que son dos incidentes muy distintos.

**Sin `SECRETS_KEY`, conectar falla a propósito.** Preferimos un error ruidoso
en el despliegue a guardar tokens en claro sin que nadie se dé cuenta.

```bash
# Generar la clave (32 bytes en hexadecimal)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Lo que solo puedes hacer tú

Igual que con Shopify: el código está escrito y probado, pero las apps las
registra el titular de la cuenta.

### 1. YouTube — lo más rápido, empieza por aquí

1. Entra en [Google Cloud Console](https://console.cloud.google.com/), crea un
   proyecto y activa **YouTube Data API v3**.
2. Credenciales → Crear → **Clave de API**. Restríngela a esa API.
3. `YOUTUBE_API_KEY=...` en el `.env` y en Netlify.

Con esto ya funciona la verificación de canales de YouTube, sin más trámites.

### 2. El servicio de consulta — lo que abre Instagram y TikTok por el @

Es lo que más desbloquea por lo que menos cuesta: con esto, las tres redes
funcionan con solo el @ y no hace falta ninguna app revisada.

1. Crear cuenta en [Apify](https://apify.com/). Tiene capa gratuita, así que se
   puede probar antes de poner una tarjeta.
2. Settings → Integrations → **API token**.
3. `APIFY_TOKEN=...` en el `.env` y en Netlify (como secreto).

Comprobarlo con un perfil cualquiera desde el panel del creador: si vuelven
seguidores y publicaciones, está listo.

Si más adelante interesa otro proveedor —hay servicios que además dan datos de
audiencia, que es algo que una marca paga— el sitio donde se cambia es
`social/lookup.js`, y es una función.

### 3. Instagram (opcional)

1. [Meta for Developers](https://developers.facebook.com/) → crear app de tipo
   **Business**.
2. Añadir el producto **Instagram** y, dentro, *API setup with Instagram
   login*.
3. Permiso: `instagram_business_basic`. Para alcance y guardados haría falta
   además `instagram_business_manage_insights`, que pasa por revisión.
4. URL de redirección: `https://TU-DOMINIO/api/social/instagram/callback`.
5. `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.

El token largo dura 60 días y se renueva solo mientras se use. Si un creador
no entra en dos meses, caduca y hay que pedirle permiso otra vez: `sync` lo
anota en `syncError` en vez de borrar nada.

### 4. TikTok (opcional)

1. [TikTok for Developers](https://developers.tiktok.com/) → crear app.
2. Productos: **Login Kit** y **Display API**.
3. Permisos: `user.info.basic`, `user.info.stats` y `video.list`. Ojo: los
   seguidores están en `user.info.stats`, que es un permiso aparte del básico.
   Pedir solo el básico y esperar `follower_count` es el error clásico.
4. URL de redirección: `https://TU-DOMINIO/api/social/tiktok/callback`.
5. `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`.

El token dura 24 h y el de refresco un año, así que renovar es lo normal en
cada sincronización, no un caso excepcional.

### 5. Avisos por WhatsApp (opcional)

Requiere WhatsApp Business Platform (Cloud API) y una plantilla aprobada por
Meta, porque fuera de la ventana de 24 h solo se pueden mandar plantillas y
nuestros avisos siempre caen fuera: nadie nos ha escrito antes.

```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
WHATSAPP_TEMPLATE=mikro_aviso     # dos parámetros de texto en el cuerpo
```

Sin configurar, Mikro funciona igual: los avisos se quedan dentro de la
aplicación.

## Mantenimiento

```bash
npm run social:sync                  # las que lleven más de 24 h sin actualizar
npm run social:sync -- --horas 6
npm run test:social                  # 102 pruebas, sin red ni base de datos
```

Conviene dejarlo en una tarea diaria. Las cifras envejecen: un engagement de
hace tres meses no describe al creador de hoy, y una marca que contrata
mirando ese número está decidiendo con datos caducados.

## Qué cambia en el ranking

El peso de «confianza» (8 %) deja de ser un sí/no de identidad verificada:

| Situación | Puntos |
|---|---|
| Cifras comprobadas **e** identidad verificada | 100 |
| Cifras comprobadas | 85 |
| Solo identidad verificada | 70 |
| Nada | 40 |

Las cifras pesan más que la identidad porque lo que una marca contrata son las
cifras, y las que calculamos de las publicaciones no las ha escrito nadie. Está declarado
en la política de privacidad, como exige el RGPD para una decisión
automatizada.

## Pendiente

- Alcance e impresiones de Instagram: hace falta pasar la revisión de
  `instagram_business_manage_insights`.
- Datos de audiencia (edad, sexo, ciudad), que ahora son declarados. Con el
  camino del @ hay un atajo que antes no existía: hay servicios de consulta
  que los incluyen, y el sitio donde se enchufaría es el mismo
  `social/lookup.js`.
- Mostrar la evolución de seguidores en el perfil: los `SocialSnapshot` ya se
  guardan, falta pintarlos.

---

## Despliegue

El sitio compila desde GitHub: cada `push` a `main` dispara una compilación en
una máquina limpia de Netlify. No hace falta desplegar a mano, y es mejor que
no se haga: compilar en un portátil con Windows metía en el paquete de la
función cosas que no pintan nada en Linux.
