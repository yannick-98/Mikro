# Datos reales de las redes sociales

> Las cifras de un creador dejan de ser lo que él escribe y pasan a ser lo que
> dicen sus publicaciones.

## Por qué no raspamos los perfiles

Es la primera pregunta y conviene contestarla antes que nada, porque raspar es
más rápido de montar y parece lo obvio.

1. **Va contra las condiciones** de Instagram, TikTok y YouTube. No es una
   cuestión teórica: bloquean por IP y cierran cuentas de desarrollador.
2. **Se rompe cada semana.** Un raspador depende del HTML de otro, que cambia
   sin avisar y sin versiones. El día que se rompe, el ranking entero empieza a
   decidirse con datos viejos y nadie se entera.
3. **Y sobre todo, no resuelve el problema.** Desde fuera solo se ve lo que la
   plataforma enseña a cualquiera, que es exactamente lo que se puede inflar
   comprando seguidores y likes. Raspar no comprueba nada: copia el mismo
   número que ya nos daba el creador, con más pasos.

Conectar la cuenta es más trabajo y es lo único que permite decir «esto es
real» sin mentir. Además deja la puerta abierta a métricas que no son públicas
—alcance, guardados, audiencia— cuando haga falta.

## Cómo funciona

```
creador conecta  ->  token cifrado  ->  sync diario  ->  métricas recalculadas
                                            |
                                            +-> publicaciones guardadas
                                            +-> foto del momento (histórico)
```

| Plataforma | Cómo se conecta | Qué hace falta |
|---|---|---|
| **Instagram** | OAuth (*Instagram API with Instagram Login*) | App en Meta + revisión |
| **TikTok** | OAuth (*Login Kit* + Display API) | App en TikTok + revisión |
| **YouTube** | Solo el nombre del canal | Una clave de API. **Funciona el primer día** |

YouTube es la excepción porque los datos de un canal son públicos y basta una
clave nuestra. El creador no tiene que autorizar nada. A cambio, eso comprueba
sus cifras pero no su identidad: para lo segundo está `verificarPropiedad()`,
que le pide poner un código en la descripción del canal, el mismo truco con el
que Google verifica dominios y por la misma razón: ahí solo escribe quien tiene
las llaves.

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

### 2. Instagram

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

### 3. TikTok

1. [TikTok for Developers](https://developers.tiktok.com/) → crear app.
2. Productos: **Login Kit** y **Display API**.
3. Permisos: `user.info.basic`, `user.info.stats` y `video.list`. Ojo: los
   seguidores están en `user.info.stats`, que es un permiso aparte del básico.
   Pedir solo el básico y esperar `follower_count` es el error clásico.
4. URL de redirección: `https://TU-DOMINIO/api/social/tiktok/callback`.
5. `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`.

El token dura 24 h y el de refresco un año, así que renovar es lo normal en
cada sincronización, no un caso excepcional.

### 4. Avisos por WhatsApp (opcional)

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
npm run test:social                  # 39 pruebas, sin red ni base de datos
```

Conviene dejarlo en una tarea diaria. Las cifras envejecen: un engagement de
hace tres meses no describe al creador de hoy, y una marca que contrata
mirando ese número está decidiendo con datos caducados.

## Qué cambia en el ranking

El peso de «confianza» (8 %) deja de ser un sí/no de identidad verificada:

| Situación | Puntos |
|---|---|
| Redes conectadas **e** identidad verificada | 100 |
| Redes conectadas | 85 |
| Solo identidad verificada | 70 |
| Nada | 40 |

Las cifras pesan más que la identidad porque lo que una marca contrata son las
cifras, y las que vienen de la plataforma no se pueden inflar. Está declarado
en la política de privacidad, como exige el RGPD para una decisión
automatizada.

## Pendiente

- Alcance e impresiones de Instagram: hace falta pasar la revisión de
  `instagram_business_manage_insights`.
- Datos de audiencia (edad, sexo, ciudad) desde las plataformas, que ahora son
  declarados.
- Mostrar la evolución de seguidores en el perfil: los `SocialSnapshot` ya se
  guardan, falta pintarlos.
