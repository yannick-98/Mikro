/**
 * Conexion de las cuentas de redes del creador.
 *
 * Lo que hay detras de estas rutas es la diferencia entre un directorio y algo
 * en lo que una marca puede gastarse el dinero: los seguidores y el engagement
 * dejan de ser lo que alguien escribio en un formulario.
 *
 * Nota sobre el camino elegido. Hay dos formas de conseguir estos datos:
 * raspar los perfiles publicos, o pedirle al creador que conecte su cuenta.
 * Lo primero es mas rapido de montar y es un error: va contra las condiciones
 * de las plataformas, se rompe cada vez que cambian el HTML, y sobre todo no
 * resuelve el problema, porque desde fuera no se ve nada que no se pueda
 * falsear. Conectar la cuenta es mas trabajo y es lo unico que permite decir
 * "esto es real" sin mentir.
 */
import { Router } from 'express'
import { z } from 'zod'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, notFound, parseBody } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'
import { encrypt, secretsConfigured } from '../lib/secrets.js'
import { APP_URL, disponible, estadoPlataformas, MODO } from '../social/config.js'
import { proveedores, recalcularCreador, sincronizarCuenta } from '../social/sync.js'

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
    if (MODO[platform] !== 'oauth') throw badRequest('Esa plataforma no se conecta así')
    if (!disponible(platform)) throw badRequest(`La conexión con ${platform} no está configurada`)
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

/**
 * YouTube: basta con decirnos el canal.
 *
 * No hay autorización, así que esto comprueba cifras pero no identidad. Para
 * lo segundo está /youtube/verificar, con un código en la descripción del
 * canal, que es algo que solo puede poner quien tiene las llaves.
 */
router.post(
  '/youtube',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const { canal } = parseBody(z.object({ canal: z.string().trim().min(2).max(200) }), req.body)
    if (!disponible('youtube')) throw badRequest('La conexión con YouTube no está configurada')

    let perfil
    try {
      perfil = await proveedores.youtube.fetchProfile(null, canal)
    } catch (e) {
      throw badRequest(e.message)
    }

    const cuenta = await prisma.socialAccount.upsert({
      where: { creatorId_platform: { creatorId: req.user.creator.id, platform: 'youtube' } },
      create: {
        creatorId: req.user.creator.id,
        platform: 'youtube',
        handle: perfil.handle,
        url: perfil.url,
        followers: perfil.followers,
        source: 'CONNECTED',
        externalId: perfil.externalId,
        connectedAt: new Date(),
      },
      update: {
        handle: perfil.handle,
        url: perfil.url,
        followers: perfil.followers,
        source: 'CONNECTED',
        externalId: perfil.externalId,
        syncError: null,
      },
    })

    const r = await sincronizarCuenta(cuenta.id)
    const actualizada = await prisma.socialAccount.findUnique({ where: { id: cuenta.id } })
    res.json({ account: cuentaPrivada(actualizada), sincronizada: r.ok, error: r.error || null })
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
