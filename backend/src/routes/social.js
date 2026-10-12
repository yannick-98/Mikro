/**
 * Conexion de las cuentas de redes del creador.
 *
 * Lo que hay detras de estas rutas es la diferencia entre un directorio y algo
 * en lo que una marca puede gastarse el dinero: los seguidores y el engagement
 * dejan de ser lo que alguien escribio en un formulario.
 *
 * ## Dos caminos, y por que
 *
 * **Por el @** (`/:platform/handle`). El creador escribe su usuario y las
 * cifras las traemos nosotros de lo publico. Es el camino normal porque es el
 * unico que no le saca de Mikro: en una pantalla de permisos de Instagram que
 * habla de "acceso a tu contenido" se cae gente, y se cae justo la que
 * todavia no conoce la marca.
 *
 * **Autorizando** (`/:platform/connect`). Mas friccion y mejor dato. Queda
 * como paso opcional para quien quiera el sello completo.
 *
 * El problema del primero no son las cifras: son reales y las calculamos
 * nosotros igual. El problema es que **cualquiera puede escribir el @ de
 * otro**. Eso no es un dato mal puesto, es venderle a una marca una audiencia
 * ajena y cobrarla. Por eso una cuenta dada de alta por el @ no cuenta para el
 * perfil publico hasta que su dueno pega un codigo en la biografia
 * (`/:platform/verificar`). Autorizar, en cambio, ya es prueba por si mismo.
 */
import { Router } from 'express'
import { z } from 'zod'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, notFound, parseBody } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'
import { encrypt, secretsConfigured } from '../lib/secrets.js'
import { APP_URL, estadoPlataformas, modosDe, PLATAFORMAS } from '../social/config.js'
import { proveedores, recalcularCreador, sincronizarCuenta } from '../social/sync.js'
import { proveedorPorHandle } from '../social/porHandle.js'
import { codigoPara, cuentaParaElPerfil, instrucciones } from '../social/propiedad.js'

const router = Router()

const SECRET = () => process.env.JWT_SECRET || 'mikro-dev-secret'

/**
 * El "state" de OAuth, firmado.
 *
 * La plataforma nos devuelve al creador sin cabecera de sesion, asi que hay
 * que saber de quien es la vuelta. Va firmado y caduca en diez minutos: sin
 * eso, cualquiera podria completar la conexion apuntando la cuenta de otro al
 * perfil que quisiera.
 */
const firmarState = (creatorId, platform) =>
  jwt.sign({ creatorId, platform, nonce: crypto.randomBytes(8).toString('hex') }, SECRET(), {
    expiresIn: '10m',
  })

function leerState(state, platform) {
  try {
    const d = jwt.verify(state, SECRET())
    if (d.platform !== platform || !d.creatorId) return null
    return d
  } catch {
    return null
  }
}

/** Cuenta tal y como la ve su dueno. Sin tokens, nunca. */
const cuentaPrivada = (c) => ({
  platform: c.platform,
  handle: c.handle,
  url: c.url,
  source: c.source,
  metodo: c.metodo,
  verificada: !!c.ownershipVerifiedAt,
  ownershipVerifiedAt: c.ownershipVerifiedAt,
  // Lo que de verdad quiere saber el creador cuando mira esta pantalla: si
  // estas cifras las esta viendo alguien mas que el.
  enElPerfil: cuentaParaElPerfil(c),
  followers: c.followers,
  engagement: c.engagement,
  avgViews: c.avgViews,
  avgLikes: c.avgLikes,
  avgComments: c.avgComments,
  postsPerWeek: c.postsPerWeek,
  postsAnalyzed: c.postsAnalyzed,
  lastPostAt: c.lastPostAt,
  connectedAt: c.connectedAt,
  lastSyncAt: c.lastSyncAt,
  syncError: c.syncError,
})

// ---------------------------------------------------------------------------

/** Que plataformas se pueden conectar en este entorno. */
router.get(
  '/platforms',
  asyncHandler(async (_req, res) => {
    res.json({ platforms: estadoPlataformas(), cifradoListo: secretsConfigured() })
  }),
)

/** Mis cuentas y como están. */
router.get(
  '/me',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const cuentas = await prisma.socialAccount.findMany({
      where: { creatorId: req.user.creator.id },
      orderBy: { platform: 'asc' },
    })
    const creator = await prisma.creator.findUnique({
      where: { id: req.user.creator.id },
      select: {
        totalFollowers: true,
        engagementRate: true,
        postsPerWeek: true,
        metricsSource: true,
        metricsVerifiedAt: true,
      },
    })
    res.json({ accounts: cuentas.map(cuentaPrivada), creator, platforms: estadoPlataformas() })
  }),
)

/**
 * Empieza la conexión: devuelve la dirección a la que hay que mandar al
 * creador. No se redirige desde aquí porque la llamada viene por fetch con su
 * token de sesión, y un 302 ahí no lleva a ninguna parte.
 */
router.post(
  '/:platform/connect',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const { platform } = req.params
    if (!modosDe(platform).includes('oauth')) {
      throw badRequest('Esa plataforma no se conecta así')
    }
    if (!secretsConfigured()) {
      throw badRequest('Falta configurar el cifrado de credenciales (SECRETS_KEY)')
    }

    const url = proveedores[platform].authUrl(firmarState(req.user.creator.id, platform))
    res.json({ url })
  }),
)

/**
 * Vuelta de la plataforma.
 *
 * Termina siempre redirigiendo al panel del creador, con el resultado en la
 * query: quien llega aquí es una persona en su navegador, y dejarle un JSON en
 * pantalla sería abandonarla a mitad de camino.
 */
router.get(
  '/:platform/callback',
  asyncHandler(async (req, res) => {
    const { platform } = req.params
    const destino = (estado, detalle) =>
      `${APP_URL()}/creador/perfil?conexion=${platform}&estado=${estado}` +
      (detalle ? `&detalle=${encodeURIComponent(detalle.slice(0, 160))}` : '')

    if (req.query.error) {
      return res.redirect(destino('cancelada', String(req.query.error_description || '')))
    }

    const datos = leerState(String(req.query.state || ''), platform)
    if (!datos) return res.redirect(destino('error', 'La solicitud caducó. Inténtalo otra vez.'))

    const code = String(req.query.code || '')
    if (!code) return res.redirect(destino('error', 'No llegó el código de autorización'))

    try {
      const prov = proveedores[platform]
      const token = await prov.exchangeCode(code)
      const perfil = await prov.fetchProfile(token.accessToken)

      const cuenta = await prisma.socialAccount.upsert({
        where: { creatorId_platform: { creatorId: datos.creatorId, platform } },
        create: {
          creatorId: datos.creatorId,
          platform,
          handle: perfil.handle || '',
          url: perfil.url,
          followers: perfil.followers,
          source: 'CONNECTED',
          metodo: 'OAUTH',
          // Autorizar es la prueba: nadie entra en la cuenta de otro para
          // darnos permiso sobre ella.
          ownershipVerifiedAt: new Date(),
          externalId: perfil.externalId || token.externalId,
          accessToken: encrypt(token.accessToken),
          refreshToken: token.refreshToken ? encrypt(token.refreshToken) : null,
          tokenExpires: new Date(Date.now() + token.expiresIn * 1000),
          scopes: token.scopes,
          connectedAt: new Date(),
        },
        update: {
          handle: perfil.handle || '',
          url: perfil.url,
          followers: perfil.followers,
          source: 'CONNECTED',
          metodo: 'OAUTH',
          ownershipVerifiedAt: new Date(),
          externalId: perfil.externalId || token.externalId,
          accessToken: encrypt(token.accessToken),
          refreshToken: token.refreshToken ? encrypt(token.refreshToken) : null,
          tokenExpires: new Date(Date.now() + token.expiresIn * 1000),
          scopes: token.scopes,
          connectedAt: new Date(),
          syncError: null,
        },
      })

      // Se sincroniza en el momento: el creador acaba de dar permiso y espera
      // ver sus cifras, no un "vuelve mañana".
      await sincronizarCuenta(cuenta.id)
      return res.redirect(destino('ok'))
    } catch (e) {
      return res.redirect(destino('error', String(e.message || e)))
    }
  }),
)

const laCuenta = (creatorId, platform) =>
  prisma.socialAccount.findUnique({ where: { creatorId_platform: { creatorId, platform } } })

/**
 * Dar de alta una cuenta con solo el @.
 *
 * Esto es el camino normal. El creador escribe su usuario, se consulta el
 * perfil ahí mismo y se le devuelven sus cifras de verdad en la misma
 * respuesta: no hay "vuelve mañana" ni pantalla de permisos.
 *
 * Ojo con lo que esto **no** hace: no comprueba de quién es la cuenta. Hasta
 * que el creador pase por /verificar, las cifras son suyas de ver pero no
 * salen al escaparate, y la respuesta lo dice en `enElPerfil` para que la
 * pantalla no tenga que adivinarlo.
 */
router.post(
  '/:platform/handle',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const { platform } = req.params
    if (!PLATAFORMAS.includes(platform)) throw notFound('Esa red no existe')

    const cuerpo = parseBody(
      z.object({
        handle: z.string().trim().min(2).max(200).optional(),
        // canal, por compatibilidad con lo que enviaba la pantalla de YouTube.
        canal: z.string().trim().min(2).max(200).optional(),
      }),
      req.body,
    )
    const handle = cuerpo.handle || cuerpo.canal || ''
    if (handle.length < 2) throw badRequest('Dinos tu usuario, por ejemplo @mikro')

    const prov = proveedorPorHandle(platform)
    if (!prov) {
      throw badRequest(
        platform === 'youtube'
          ? 'La lectura de YouTube no está configurada'
          : `Ahora mismo no podemos leer perfiles de ${platform}. Puedes conectar la cuenta.`,
      )
    }

    let perfil
    try {
      perfil = await prov.fetchProfile(null, handle)
    } catch (e) {
      throw badRequest(e.message)
    }

    const comun = {
      handle: perfil.handle,
      url: perfil.url,
      followers: perfil.followers,
      source: 'CONNECTED',
      metodo: 'LOOKUP',
      externalId: perfil.externalId,
      syncError: null,
    }

    const existente = await laCuenta(req.user.creator.id, platform)
    // Cambiar de @ invalida la verificación anterior: lo comprobado era que
    // la cuenta vieja era suya, no la nueva.
    const cambiaDeCuenta = existente && existente.handle !== perfil.handle

    const cuenta = await prisma.socialAccount.upsert({
      where: { creatorId_platform: { creatorId: req.user.creator.id, platform } },
      create: { creatorId: req.user.creator.id, platform, ...comun, connectedAt: new Date() },
      update: { ...comun, ...(cambiaDeCuenta ? { ownershipVerifiedAt: null } : {}) },
    })

    const r = await sincronizarCuenta(cuenta.id)
    const actualizada = await laCuenta(req.user.creator.id, platform)

    res.json({
      account: cuentaPrivada(actualizada),
      sincronizada: r.ok,
      error: r.error || null,
      propiedad: actualizada.ownershipVerifiedAt
        ? null
        : instrucciones(platform, codigoPara(req.user.creator.id, platform)),
    })
  }),
)

/** El código que hay que pegar en la biografía, y dónde. */
router.get(
  '/:platform/propiedad',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const { platform } = req.params
    if (!PLATAFORMAS.includes(platform)) throw notFound('Esa red no existe')
    const cuenta = await laCuenta(req.user.creator.id, platform)
    res.json({
      ...instrucciones(platform, codigoPara(req.user.creator.id, platform)),
      verificada: !!cuenta?.ownershipVerifiedAt,
    })
  }),
)

/**
 * Comprueba el código y, si está, da la cuenta por verificada.
 *
 * A partir de aquí sus cifras entran en el perfil público, así que se vuelven
 * a calcular los agregados del creador en el momento.
 */
router.post(
  '/:platform/verificar',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const { platform } = req.params
    const cuenta = await laCuenta(req.user.creator.id, platform)
    if (!cuenta) throw notFound('No tienes esa cuenta dada de alta')

    const prov = proveedorPorHandle(platform)
    if (!prov?.verificarPropiedad) throw badRequest('Esa red no se puede verificar así')

    const codigo = codigoPara(req.user.creator.id, platform)
    let encontrado
    try {
      encontrado = await prov.verificarPropiedad(cuenta.externalId || cuenta.handle, codigo)
    } catch (e) {
      throw badRequest(e.message)
    }

    if (!encontrado) {
      return res.json({
        verificada: false,
        // Sin esto, el creador que ha puesto el codigo y ha dado a comprobar
        // demasiado pronto no sabe si se equivoco o si solo fue rapido.
        motivo:
          'No encontramos el código. Si lo acabas de poner, espera un minuto: las redes tardan un rato en publicar el cambio.',
        ...instrucciones(platform, codigo),
      })
    }

    await prisma.socialAccount.update({
      where: { id: cuenta.id },
      data: { ownershipVerifiedAt: new Date() },
    })
    const creator = await recalcularCreador(req.user.creator.id)
    const actualizada = await laCuenta(req.user.creator.id, platform)

    res.json({
      verificada: true,
      account: cuentaPrivada(actualizada),
      creator: {
        totalFollowers: creator.totalFollowers,
        engagementRate: creator.engagementRate,
        postsPerWeek: creator.postsPerWeek,
        metricsSource: creator.metricsSource,
      },
    })
  }),
)

/** Vuelve a pedir los datos ahora mismo. */
router.post(
  '/:platform/sync',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const cuenta = await prisma.socialAccount.findUnique({
      where: { creatorId_platform: { creatorId: req.user.creator.id, platform: req.params.platform } },
    })
    if (!cuenta) throw notFound('No tienes esa cuenta conectada')

    const r = await sincronizarCuenta(cuenta.id)
    const actualizada = await prisma.socialAccount.findUnique({ where: { id: cuenta.id } })
    res.json({ account: cuentaPrivada(actualizada), ok: r.ok, error: r.error || null })
  }),
)

/**
 * Desconecta.
 *
 * Se borra la cuenta entera, con sus publicaciones y su histórico. Quien
 * retira el permiso retira el permiso: quedarnos con lo que trajimos
 * "porque ya lo teníamos" sería justo lo que no se debe hacer. Las cifras del
 * perfil vuelven a recalcularse sin ella y, si era la única conectada, el
 * perfil vuelve a estar declarado.
 */
router.delete(
  '/:platform',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const cuenta = await prisma.socialAccount.findUnique({
      where: { creatorId_platform: { creatorId: req.user.creator.id, platform: req.params.platform } },
    })
    if (!cuenta) throw notFound('No tienes esa cuenta')

    await prisma.socialAccount.delete({ where: { id: cuenta.id } })
    const creator = await recalcularCreador(req.user.creator.id)
    res.json({ ok: true, creator: { totalFollowers: creator.totalFollowers, metricsSource: creator.metricsSource } })
  }),
)

export default router
