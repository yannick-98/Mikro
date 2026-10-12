/**
 * Planes y suscripciones.
 *
 * El catalogo es publico porque la pagina de precios tiene que poder verse
 * sin cuenta: pedir registro para saber cuanto cuesta algo es la forma mas
 * rapida de que alguien se vaya.
 *
 * Lo que cambia si hay sesion es que la tabla se calcula **con el gasto real
 * de esa empresa** en vez de con un numero de ejemplo. Y entonces la
 * recomendacion puede decir "bajate de plan", que es el caso que de verdad
 * importa: ver billing/planes.js.
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, parseBody } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'
import { stripeConfigured } from '../stripe/config.js'
import { COMISION_BASE, comparar, planPorId, recomendar } from '../billing/planes.js'
import {
  abrirSuscripcion,
  enlaceDePortal,
  gastoMensual,
} from '../billing/suscripciones.js'

const router = Router()

/** Gasto de ejemplo para quien todavia no tiene historial con nosotros. */
const GASTO_EJEMPLO = 1000

router.get(
  '/planes',
  asyncHandler(async (req, res) => {
    const brandId = req.user?.brand?.id
    const brand = brandId ? await prisma.brand.findUnique({ where: { id: brandId } }) : null

    const historial = brandId ? await gastoMensual(brandId) : null
    // Con menos de dos colaboraciones el gasto del ultimo mes no describe
    // nada: una sola de 2.000 EUR recomendaria Agencia a quien no va a
    // repetir. Hasta entonces se ensena el ejemplo y se dice que lo es.
    const conDatos = (historial?.colaboraciones || 0) >= 2
    const gasto = conDatos ? historial.gasto : GASTO_EJEMPLO

    res.json({
      configurado: stripeConfigured(),
      comisionBase: COMISION_BASE(),
      planes: comparar(gasto),
      gasto: { importe: gasto, esEjemplo: !conDatos, ...(historial || {}) },
      recomendado: recomendar(gasto).id,
      actual: brand
        ? {
            plan: brand.plan || 'FREE',
            estado: brand.planStatus || null,
            renuevaEl: brand.planRenewsAt,
            terminaEl: brand.planEndsAt,
            tienePasarela: !!brand.stripeCustomerId,
          }
        : null,
    })
  }),
)

/** Empieza la contratación. Devuelve a dónde hay que ir a pagar. */
router.post(
  '/suscribir',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    if (!stripeConfigured()) throw badRequest('Los pagos no están activados en este entorno')

    const { plan } = parseBody(z.object({ plan: z.enum(['PRO', 'AGENCIA']) }), req.body)

    const brand = await prisma.brand.findUnique({
      where: { id: req.user.brand.id },
      include: { user: { select: { email: true } } },
    })

    if (brand.plan === plan && brand.planStatus === 'active') {
      throw badRequest(`Ya tienes el plan ${planPorId(plan).nombre}`)
    }

    // Quien ya tiene una suscripcion no pasa por una pagina de pago nueva:
    // eso crearia una segunda y le cobrariamos dos. El cambio de plan se hace
    // en el portal, que ademas prorratea lo que ya pago.
    if (brand.stripeSubscriptionId && brand.planStatus === 'active') {
      return res.json({ url: await enlaceDePortal(brand), motivo: 'cambio' })
    }

    try {
      res.json({ url: await abrirSuscripcion(brand, plan) })
    } catch (e) {
      throw badRequest(e.message)
    }
  }),
)

/** Facturas, tarjeta y baja: todo en el portal de Stripe. */
router.post(
  '/portal',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({ where: { id: req.user.brand.id } })
    try {
      res.json({ url: await enlaceDePortal(brand) })
    } catch (e) {
      throw badRequest(e.message)
    }
  }),
)

export default router
