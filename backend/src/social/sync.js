/**
 * Traer los datos reales de una cuenta y recalcular las cifras del creador.
 *
 * Esto es lo que convierte el perfil de Mikro de "lo que dice el creador" a
 * "lo que dicen sus publicaciones". El orden importa:
 *
 *   1. token valido (renovandolo si hace falta);
 *   2. perfil -> seguidores de verdad;
 *   3. ultimas publicaciones -> engagement y frecuencia calculados aqui;
 *   4. una foto del momento, para poder ver la evolucion despues;
 *   5. recalculo de los agregados del creador y de su puntuacion.
 *
 * Un fallo se guarda en syncError y no borra nada. Un token caducado no
 * significa que las cifras de la semana pasada sean mentira; significa que hay
 * que pedirle al creador que vuelva a conectar, y mientras tanto se ensena lo
 * ultimo que si sabiamos, con su fecha.
 */
import { prisma } from '../lib/prisma.js'
import { decrypt, encrypt } from '../lib/secrets.js'
import { computeScore } from '../services/scoring.js'
import { resumirCuenta } from './metrics.js'
import { proveedorPorHandle } from './porHandle.js'
import { cuentaParaElPerfil } from './propiedad.js'
import instagram from './providers/instagram.js'
import tiktok from './providers/tiktok.js'
import youtube from './providers/youtube.js'

export const proveedores = { instagram, tiktok, youtube }

/**
 * De donde se traen los datos de una cuenta concreta.
 *
 * Lo decide la cuenta y no la plataforma, porque las dos cosas pueden
 * convivir: un creador da de alta su Instagram con solo el @ y el de al lado
 * lo conecta de verdad, y las dos cuentas se sincronizan igual de bien.
 */
export function implementacionDe(cuenta) {
  if (cuenta.metodo === 'LOOKUP') return proveedorPorHandle(cuenta.platform)
  return proveedores[cuenta.platform] || null
}

/** Margen con el que se renueva un token antes de que caduque. */
const MARGEN_MS = 10 * 60 * 1000

/**
 * Devuelve un token utilizable, renovandolo si toca.
 * null significa que hay que volver a conectar la cuenta.
 */
async function tokenValido(cuenta) {
  const prov = proveedores[cuenta.platform]
  if (prov.modo !== 'oauth') return null // youtube no usa token del creador

  const actual = decrypt(cuenta.accessToken)
  const vigente = cuenta.tokenExpires && cuenta.tokenExpires.getTime() - Date.now() > MARGEN_MS
  if (actual && vigente) return actual

  try {
    let datos
    if (cuenta.platform === 'tiktok') {
      const refreshToken = decrypt(cuenta.refreshToken)
      if (!refreshToken) return null
      datos = await prov.refresh(refreshToken)
    } else {
      if (!actual) return null
      datos = await prov.refresh(actual)
    }

    await prisma.socialAccount.update({
      where: { id: cuenta.id },
      data: {
        accessToken: encrypt(datos.accessToken),
        ...(datos.refreshToken ? { refreshToken: encrypt(datos.refreshToken) } : {}),
        tokenExpires: new Date(Date.now() + datos.expiresIn * 1000),
      },
    })
    return datos.accessToken
  } catch {
    return null
  }
}

/**
 * Sincroniza una cuenta. Devuelve { ok, error } y deja todo guardado.
 */
export async function sincronizarCuenta(cuentaId) {
  const cuenta = await prisma.socialAccount.findUnique({ where: { id: cuentaId } })
  if (!cuenta) return { ok: false, error: 'La cuenta no existe' }
  if (cuenta.source !== 'CONNECTED') return { ok: false, error: 'Esa cuenta no está conectada' }

  const prov = implementacionDe(cuenta)
  if (!prov) {
    return { ok: false, error: `Ahora mismo no se pueden leer los datos de ${cuenta.platform}` }
  }

  try {
    let token = null
    if (prov.modo === 'oauth') {
      token = await tokenValido(cuenta)
      if (!token) throw new Error('El permiso ha caducado: vuelve a conectar la cuenta')
    }

    const referencia = prov.modo === 'handle' ? cuenta.externalId || cuenta.handle : undefined
    const perfil = await prov.fetchProfile(token, referencia)
    const posts = (await prov.fetchPosts(token, prov.modo === 'handle' ? perfil : 25)).filter(
      (p) => p.publishedAt,
    )

    // Las publicaciones se guardan antes de calcular: si el calculo cambia
    // manana, se puede rehacer sobre los mismos datos sin volver a pedirlos.
    for (const p of posts) {
      await prisma.socialPost.upsert({
        where: { accountId_externalId: { accountId: cuenta.id, externalId: p.externalId } },
        create: { accountId: cuenta.id, ...p },
        // Los contadores suben con el tiempo: en una publicacion ya conocida
        // se actualizan, porque la cifra buena es la ultima.
        update: {
          likes: p.likes,
          comments: p.comments,
          views: p.views ?? 0,
          shares: p.shares ?? 0,
          thumbnailUrl: p.thumbnailUrl,
          permalink: p.permalink,
          fetchedAt: new Date(),
        },
      })
    }

    const guardadas = await prisma.socialPost.findMany({
      where: { accountId: cuenta.id },
      orderBy: { publishedAt: 'desc' },
      take: 40,
    })
    const snapshots = await prisma.socialSnapshot.findMany({
      where: { accountId: cuenta.id },
      orderBy: { takenAt: 'desc' },
      take: 20,
    })

    const resumen = resumirCuenta({ posts: guardadas, followers: perfil.followers, snapshots })

    await prisma.socialAccount.update({
      where: { id: cuenta.id },
      data: {
        handle: perfil.handle || cuenta.handle,
        url: perfil.url || cuenta.url,
        externalId: perfil.externalId || cuenta.externalId,
        followers: perfil.followers,
        engagement: resumen.engagement,
        avgViews: resumen.avgViews,
        postsAnalyzed: resumen.postsAnalyzed,
        postsPerWeek: resumen.postsPerWeek,
        avgLikes: resumen.avgLikes,
        avgComments: resumen.avgComments,
        lastPostAt: resumen.lastPostAt,
        lastSyncAt: new Date(),
        syncError: null,
      },
    })

    await prisma.socialSnapshot.create({
      data: {
        accountId: cuenta.id,
        followers: perfil.followers,
        engagement: resumen.engagement,
        postsPerWeek: resumen.postsPerWeek,
      },
    })

    await recalcularCreador(cuenta.creatorId)
    return { ok: true, resumen }
  } catch (e) {
    await prisma.socialAccount.update({
      where: { id: cuenta.id },
      data: { syncError: String(e.message || e).slice(0, 300), lastSyncAt: new Date() },
    })
    return { ok: false, error: e.message || String(e) }
  }
}

/**
 * Rehace las cifras del creador a partir de sus cuentas.
 *
 * El engagement global se pondera por seguidores: una cuenta de 50.000 con un
 * 3% dice mas sobre el alcance real de ese creador que una de 800 con un 12%,
 * y promediarlas a secas regalaria una cifra que no se corresponde con lo que
 * la marca va a recibir.
 *
 * En cuanto hay una sola cuenta conectada, el perfil entero pasa a contar como
 * comprobado y las cuentas declaradas dejan de aportar a los agregados: mezclar
 * lo medido con lo dicho produce un numero que no es ninguna de las dos cosas.
 */
export async function recalcularCreador(creatorId) {
  const cuentas = await prisma.socialAccount.findMany({ where: { creatorId } })
  const conectadas = cuentas.filter(cuentaParaElPerfil)
  // Lo que se ensena cuando todavia no hay nada comprobado es lo que el
  // creador declaro, no las cifras de una cuenta por @ sin verificar: esas
  // son numeros de verdad de una cuenta que quiza no es suya, que es
  // precisamente lo que no se puede publicar.
  const base = conectadas.length ? conectadas : cuentas.filter((c) => c.source === 'DECLARED')

  const followers = base.reduce((a, c) => a + (c.followers || 0), 0)
  const engagement = followers
    ? base.reduce((a, c) => a + (c.engagement || 0) * (c.followers || 0), 0) / followers
    : 0
  // La frecuencia se suma: quien publica en dos redes publica dos veces.
  const porSemana = base.reduce((a, c) => a + (c.postsPerWeek || 0), 0)

  const creador = await prisma.creator.update({
    where: { id: creatorId },
    data: {
      totalFollowers: followers,
      engagementRate: Math.round(engagement * 100) / 100,
      postsPerWeek: Math.round(porSemana * 100) / 100,
      metricsSource: conectadas.length ? 'CONNECTED' : 'DECLARED',
      metricsVerifiedAt: conectadas.length
        ? conectadas.reduce(
            (max, c) => (c.lastSyncAt && (!max || c.lastSyncAt > max) ? c.lastSyncAt : max),
            null,
          )
        : null,
    },
  })

  await prisma.creator.update({
    where: { id: creatorId },
    data: { score: computeScore(creador) },
  })

  return creador
}

/**
 * Sincroniza todas las cuentas que lo necesiten.
 *
 * Pensado para una tarea periodica. De una en una y no en paralelo: a las
 * plataformas no les gusta que les llueva, y aqui no hay ninguna prisa.
 */
export async function sincronizarPendientes({ horas = 24, horasLookup = 72, limite = 50 } = {}) {
  const vencida = (h) => ({
    OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - h * 3600000) } }],
  })

  // Instagram y TikTok por @ pasan por un servicio que cobra por consulta, y
  // se refrescan cada tres dias en vez de cada dia. Los seguidores de alguien
  // no cambian lo suficiente en veinticuatro horas para pagar por verlo: con
  // mil creadores, la diferencia entre un dia y tres son dos tercios de la
  // factura por un dato que nadie habria notado.
  const dePago = { metodo: 'LOOKUP', platform: { in: ['instagram', 'tiktok'] } }

  const cuentas = await prisma.socialAccount.findMany({
    where: {
      source: 'CONNECTED',
      OR: [
        { ...dePago, ...vencida(horasLookup) },
        { NOT: dePago, ...vencida(horas) },
      ],
    },
    orderBy: { lastSyncAt: 'asc' },
    take: limite,
    select: { id: true, platform: true, handle: true },
  })

  const resultados = []
  for (const c of cuentas) {
    const r = await sincronizarCuenta(c.id)
    resultados.push({ ...c, ...r })
  }
  return resultados
}

export default {
  sincronizarCuenta,
  sincronizarPendientes,
  recalcularCreador,
  proveedores,
  implementacionDe,
  cuentaParaElPerfil,
}
