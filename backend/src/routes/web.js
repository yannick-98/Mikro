/**
 * Diagnostico de la web de una empresa.
 *
 * Tiene fichero propio y no vive en `tools.js` por una diferencia real: las
 * demas herramientas convierten datos que Mikro ya tiene; esta sale a
 * internet a buscarlos. Eso le trae tres problemas que las otras no tienen
 * (que no nos usen de escaner, que una web lenta no nos tumbe la funcion y
 * que el mismo analisis no se repita cien veces) y los tres se resuelven
 * aqui, en la puerta.
 *
 * Es publica a proposito, igual que el precio de referencia. Una pyme que
 * nunca ha oido hablar de nosotros escribe su direccion, recibe un informe
 * util de verdad y descubre de paso que su web no esta preparada para
 * recibir el trafico que le traeria un creador. Esa es la conversacion que
 * queremos tener, y empieza dandole algo antes de pedirle nada.
 */
import { Router } from 'express'
import { z } from 'zod'
import { HttpError, asyncHandler, badRequest, parseBody } from '../lib/http.js'
import { publicCache, remember } from '../lib/cache.js'
import { quien, ritmo } from '../lib/ritmo.js'
import { requireRole } from '../middleware/auth.js'
import { WebInvalida, analizarWeb, informeEnTexto, normalizar } from '../web/index.js'

const router = Router()

/**
 * Seis analisis cada diez minutos por IP.
 *
 * Da de sobra para probar la propia web, corregir algo y volver a mirar, que
 * es el uso honrado; y no da para recorrerse una lista de dominios.
 */
const LIMITE = { veces: 6, segundos: 600 }

/** Media hora. Una web no cambia entre dos cafes, y el analisis cuesta seis peticiones. */
const CACHE_SEGUNDOS = 1800

function pedirAnalisis(req, entrada) {
  let url
  try {
    url = normalizar(entrada)
  } catch (e) {
    if (e instanceof WebInvalida) throw badRequest(e.message)
    throw e
  }

  const paso = ritmo(`web:${quien(req)}`, LIMITE)
  if (!paso.ok) {
    throw new HttpError(
      429,
      `Has analizado unas cuantas webs seguidas. Prueba otra vez en ${Math.ceil(paso.esperaSegundos / 60)} minutos.`,
    )
  }

  // La clave de cache es la URL ya normalizada: "Tienda.es", "tienda.es/" y
  // "https://tienda.es" son el mismo analisis y no deben costar tres.
  return remember(`web:${url.href}`, CACHE_SEGUNDOS, async () => {
    try {
      return await analizarWeb(url.href)
    } catch (e) {
      if (e instanceof WebInvalida) throw badRequest(e.message)
      throw e
    }
  })
}

const cuerpo = z.object({ url: z.string().trim().min(3).max(300) })

router.post(
  '/analisis',
  asyncHandler(async (req, res) => {
    const { url } = parseBody(cuerpo, req.body)
    res.json(await pedirAnalisis(req, url))
  }),
)

/**
 * La misma cosa por GET, para que un informe se pueda enlazar y compartir.
 * Es el camino por el que esto llega al que de verdad va a arreglar la web.
 */
router.get(
  '/analisis',
  asyncHandler(async (req, res) => {
    if (!req.query.url) throw badRequest('Dinos qué web quieres analizar')
    const informe = await pedirAnalisis(req, String(req.query.url))
    publicCache(res, { maxAge: CACHE_SEGUNDOS, swr: CACHE_SEGUNDOS * 2 })
    res.json(informe)
  }),
)

/**
 * En texto plano, para pegarlo en un correo o en un WhatsApp.
 *
 * Quien pide el informe casi nunca es quien va a tocar la web: lo reenvia. Si
 * para reenviarlo hay que hacer capturas de pantalla, no se reenvia.
 */
router.get(
  '/analisis.txt',
  asyncHandler(async (req, res) => {
    if (!req.query.url) throw badRequest('Dinos qué web quieres analizar')
    const informe = await pedirAnalisis(req, String(req.query.url))
    publicCache(res, { maxAge: CACHE_SEGUNDOS, swr: CACHE_SEGUNDOS * 2 })
    res.type('text/plain; charset=utf-8').send(informeEnTexto(informe))
  }),
)

/** La mia: la empresa ya nos dijo su web al registrarse, no se la pedimos otra vez. */
router.get(
  '/analisis/mia',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const web = req.user.brand?.website
    if (!web) throw badRequest('Todavía no has puesto la dirección de tu web en tu perfil')
    res.json(await pedirAnalisis(req, web))
  }),
)

export default router
