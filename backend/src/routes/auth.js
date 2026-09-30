import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js'
import { asyncHandler, conflict, parseBody, unauthorized } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { publicUser } from '../services/serialize.js'
import { avatarFor } from '../services/media.js'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('Email no valido'),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'Indica tu nombre'),
  role: z.enum(['BRAND', 'CREATOR']),
  // marca
  companyName: z.string().optional(),
  sector: z.string().optional(),
  // creador
  handle: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
})

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = parseBody(registerSchema, req.body)
    const email = data.email.toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw conflict('Ya existe una cuenta con ese email')

    const passwordHash = await hashPassword(data.password)
    const city = data.city || 'Madrid'

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: data.name,
        role: data.role,
        avatarUrl: avatarFor(data.name),
        ...(data.role === 'BRAND'
          ? {
              brand: {
                create: {
                  companyName: data.companyName || data.name,
                  sector: data.sector || 'Otros',
                  city,
                },
              },
            }
          : {
              creator: {
                create: {
                  handle: await uniqueHandle(data.handle || data.name),
                  displayName: data.name,
                  category: data.category || 'Lifestyle',
                  city,
                  avatarUrl: avatarFor(data.name),
                },
              },
            }),
      },
      include: { brand: true, creator: true },
    })

    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  }),
)

async function uniqueHandle(base) {
  const slug =
    String(base)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 20) || 'creador'
  let handle = slug
  let i = 1
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.creator.findUnique({ where: { handle } })) {
    handle = `${slug}${++i}`
  }
  return handle
}

const loginSchema = z.object({
  email: z.string().email('Email no valido'),
  password: z.string().min(1, 'Introduce tu contrasena'),
})

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { brand: true, creator: true },
    })
    if (!user) throw unauthorized('Email o contrasena incorrectos')
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) throw unauthorized('Email o contrasena incorrectos')
    res.json({ token: signToken(user), user: publicUser(user) })
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) })
  }),
)

const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = parseBody(updateMeSchema, req.body)
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { brand: true, creator: true },
    })
    res.json({ user: publicUser(user) })
  }),
)

export default router
