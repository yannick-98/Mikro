/**
 * Alta de cobros del creador y estado de la pasarela.
 *
 * El cobro de una colaboracion no esta aqui sino en el flujo de la propia
 * colaboracion (`/deals/:id/fund`), que es donde tiene sentido: pagar no es
 * una gestion aparte, es el paso siguiente de aceptar a alguien.
 */
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, notFound } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'
import { stripeConfigured } from '../stripe/config.js'
import {
  asegurarCuenta,
  enlaceDeAlta,
  enlaceDePanel,
  estadoCobros,
  refrescarCuenta,
} from '../stripe/accounts.js'

const router = Router()

/** Si en este entorno se cobra de verdad. La interfaz tiene que saberlo. */
router.get(
  '/estado',
  asyncHandler(async (_req, res) => {
    res.json({ configurado: stripeConfigured() })
  }),
)

/** Mi situación de cobros, como creador. */
router.get(
  '/cuenta',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUnique({
      where: { id: req.user.creator.id },
      select: {
        stripeAccountId: true,
        stripePayoutsOk: true,
        stripeChargesOk: true,
        stripePendiente: true,
        stripeOnboardedAt: true,
      },
    })
    res.json({ configurado: stripeConfigured(), ...estadoCobros(creator) })
  }),
)

/**
 * Empieza o continúa el alta. Devuelve la dirección del formulario de
 * Stripe, que caduca en minutos: por eso se pide uno nuevo cada vez.
 */
router.post(
  '/cuenta',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    if (!stripeConfigured()) throw badRequest('Los cobros no están activados en este entorno')

    const creator = await prisma.creator.findUnique({
      where: { id: req.user.creator.id },
      include: { user: { select: { email: true } } },
    })

    const accountId = await asegurarCuenta(creator)
    res.json({ url: await enlaceDeAlta(accountId) })
  }),
)

/**
 * Vuelve a preguntarle a Stripe cómo está la cuenta.
 *
 * Existe porque el creador acaba de terminar el formulario y está mirando la
 * pantalla: el webhook llegará en unos segundos, pero él quiere verlo ahora.
 */
router.post(
  '/cuenta/refrescar',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUnique({ where: { id: req.user.creator.id } })
    if (!creator?.stripeAccountId) throw notFound('Todavía no has empezado el alta')

    const actualizado = await refrescarCuenta(creator.stripeAccountId)
    res.json({ configurado: true, ...estadoCobros(actualizado || creator) })
  }),
)

/** El panel de Stripe del creador: sus cobros y su cuenta bancaria. */
router.get(
  '/cuenta/panel',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUnique({ where: { id: req.user.creator.id } })
    if (!creator?.stripeAccountId) throw notFound('Todavía no tienes cuenta de cobros')
    if (!creator.stripePayoutsOk) throw badRequest('Termina primero el alta')

    res.json({ url: await enlaceDePanel(creator.stripeAccountId) })
  }),
)

export default router
