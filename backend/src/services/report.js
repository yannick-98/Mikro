/**
 * El informe de una campana.
 *
 * Hoy una pyme paga 250 EUR, recibe un reel y no sabe que paso. Esto es lo que
 * contesta esa pregunta, y es tambien lo que justifica la comision: sin una
 * cifra de resultado, Mikro cobra por presentar a dos personas; con ella,
 * cobra sobre algo que se puede mirar.
 *
 * Tres fuentes, y conviene no mezclarlas:
 *
 *  - **Lo que costo**: sale de las colaboraciones. Es exacto.
 *  - **Lo que se publico**: likes, comentarios y visualizaciones reales de las
 *    publicaciones, cuando el creador tiene la cuenta conectada. Si no, no hay
 *    cifra; no se estima.
 *  - **Lo que vendio**: solo si la tienda esta conectada con Shopify. Es la
 *    unica que mide dinero que entra.
 *
 * Cuando una fuente no esta disponible se devuelve null y se explica por que.
 * Un informe que rellena huecos con suposiciones no es un informe.
 */
import { prisma } from '../lib/prisma.js'

const ESTADOS_CONTRATADOS = ['ACCEPTED', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID']

const redondea = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d)

/**
 * Busca la publicacion real detras de la URL que entrego el creador.
 *
 * Es lo que convierte "aqui tienes el enlace" en "esto hizo". Se compara por
 * el identificador del permalink y no por la cadena entera, porque las URLs
 * que pega la gente traen parametros, barras finales y a veces el dominio
 * movil.
 */
function casarPublicacion(url, posts) {
  if (!url) return null
  const limpia = (u) =>
    String(u)
      .split('?')[0]
      .replace(/\/$/, '')
      .replace(/^https?:\/\/(www\.|m\.)?/, '')
      .toLowerCase()
  const objetivo = limpia(url)
  return (
    posts.find((p) => p.permalink && limpia(p.permalink) === objetivo) ||
    posts.find((p) => p.permalink && objetivo.includes(limpia(p.permalink))) ||
    null
  )
}

export async function informeDeCampana(campaignId, { brandId } = {}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { brand: true },
  })
  if (!campaign) return null
  if (brandId && campaign.brandId !== brandId) return null

  const [deals, atribuciones, aplicaciones] = await Promise.all([
    prisma.deal.findMany({
      where: { campaignId },
      include: {
        creator: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            totalFollowers: true,
            engagementRate: true,
            metricsSource: true,
            socialAccounts: { select: { id: true, platform: true, source: true } },
          },
        },
        submissions: { orderBy: { version: 'desc' } },
      },
    }),
    prisma.shopifyAttribution.findMany({
      where: { campaignId },
      include: { shop: { select: { currency: true } }, creator: { select: { id: true } } },
    }),
    prisma.application.count({ where: { campaignId } }),
  ])

  // Las publicaciones de los creadores que participaron, para casarlas con lo
  // que entregaron.
  const cuentas = deals.flatMap((d) => d.creator?.socialAccounts || []).map((a) => a.id)

  // Acotada por fecha y por numero: solo hace falta encontrar la publicacion
  // que entrego cada creador, no su historial entero. Sin el limite, una
  // campana con varios creadores activos se traia miles de filas para casar
  // cuatro enlaces.
  const desde = new Date(campaign.createdAt.getTime() - 30 * 86400000)
  const posts = cuentas.length
    ? await prisma.socialPost.findMany({
        where: { accountId: { in: cuentas }, publishedAt: { gte: desde } },
        orderBy: { publishedAt: 'desc' },
        take: 400,
        select: {
          permalink: true,
          likes: true,
          comments: true,
          views: true,
          shares: true,
          mediaType: true,
          publishedAt: true,
          thumbnailUrl: true,
        },
      })
    : []

  const ventasPorCreador = new Map()
  for (const a of atribuciones) {
    if (!a.creatorId) continue
    const previo = ventasPorCreador.get(a.creatorId) || { pedidos: 0, bruto: 0, devuelto: 0 }
    ventasPorCreador.set(a.creatorId, {
      pedidos: previo.pedidos + a.ordersCount,
      bruto: previo.bruto + a.salesTotal,
      devuelto: previo.devuelto + a.refundedTotal,
    })
  }

  const participaciones = deals
    .filter((d) => ESTADOS_CONTRATADOS.includes(d.status))
    .map((d) => {
      const entrega = d.submissions.find((s) => s.status === 'APPROVED') || d.submissions[0] || null
      const url = entrega?.url || d.contentUrl || null
      const publicacion = casarPublicacion(url, posts)
      const ventas = ventasPorCreador.get(d.creatorId) || null

      return {
        dealId: d.id,
        estado: d.status,
        coste: d.fee,
        creator: d.creator
          ? {
              id: d.creator.id,
              handle: d.creator.handle,
              displayName: d.creator.displayName,
              avatarUrl: d.creator.avatarUrl,
              followers: d.creator.totalFollowers,
              engagement: d.creator.engagementRate,
              metricsSource: d.creator.metricsSource,
            }
          : null,
        contenido: url
          ? {
              url,
              // Solo hay cifras si la cuenta esta conectada y hemos encontrado
              // la publicacion. Si no, se dice que no se puede medir.
              medido: !!publicacion,
              likes: publicacion?.likes ?? null,
              comments: publicacion?.comments ?? null,
              views: publicacion?.views || null,
              shares: publicacion?.shares || null,
              mediaType: publicacion?.mediaType ?? null,
              thumbnailUrl: publicacion?.thumbnailUrl ?? null,
              publishedAt: publicacion?.publishedAt ?? null,
            }
          : null,
        ventas: ventas ? { ...ventas, neto: redondea(ventas.bruto - ventas.devuelto) } : null,
      }
    })

  const coste = participaciones.reduce((a, p) => a + p.coste, 0)
  const comision = deals
    .filter((d) => ESTADOS_CONTRATADOS.includes(d.status))
    .reduce((a, d) => a + (d.feePlatform || 0), 0)

  const medidos = participaciones.filter((p) => p.contenido?.medido)
  const interacciones = medidos.reduce(
    (a, p) => a + (p.contenido.likes || 0) + (p.contenido.comments || 0),
    0,
  )
  const visualizaciones = medidos.reduce((a, p) => a + (p.contenido.views || 0), 0)

  const hayTienda = atribuciones.length > 0
  const ventasBrutas = atribuciones.reduce((a, x) => a + x.salesTotal, 0)
  const devuelto = atribuciones.reduce((a, x) => a + x.refundedTotal, 0)
  const pedidos = atribuciones.reduce((a, x) => a + x.ordersCount, 0)
  const neto = ventasBrutas - devuelto

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      category: campaign.category,
      createdAt: campaign.createdAt,
      brand: { id: campaign.brand.id, companyName: campaign.brand.companyName, logoUrl: campaign.brand.logoUrl },
    },
    resumen: {
      candidaturas: aplicaciones,
      creadores: participaciones.length,
      coste,
      comision,
      // Alcance potencial: la suma de seguidores. Se llama potencial a
      // proposito, que no es lo mismo que la gente que lo vio.
      alcancePotencial: participaciones.reduce((a, p) => a + (p.creator?.followers || 0), 0),
      contenidosMedidos: medidos.length,
      contenidosSinMedir: participaciones.filter((p) => p.contenido && !p.contenido.medido).length,
      interacciones: medidos.length ? interacciones : null,
      visualizaciones: medidos.length && visualizaciones ? visualizaciones : null,
      costePorInteraccion:
        medidos.length && interacciones > 0 ? redondea(coste / interacciones) : null,
      costePorMil:
        medidos.length && visualizaciones > 0 ? redondea((coste / visualizaciones) * 1000) : null,
    },
    ventas: hayTienda
      ? {
          moneda: atribuciones[0]?.shop?.currency || 'EUR',
          pedidos,
          bruto: redondea(ventasBrutas),
          devuelto: redondea(devuelto),
          neto: redondea(neto),
          // Lo unico que de verdad contesta "merecio la pena": cuanto entro
          // por cada euro gastado.
          retorno: coste > 0 ? redondea(neto / coste) : null,
          ticketMedio: pedidos > 0 ? redondea(neto / pedidos) : null,
        }
      : null,
    // Por que falta cada cosa. Sin esto, un hueco parece un cero.
    avisos: [
      !hayTienda
        ? {
            codigo: 'SIN_TIENDA',
            texto:
              'No hay ventas medidas porque esta cuenta no tiene una tienda de Shopify conectada. Con la tienda conectada, cada colaboración lleva su código y las ventas aparecen aquí.',
          }
        : null,
      participaciones.some((p) => p.contenido && !p.contenido.medido)
        ? {
            codigo: 'CONTENIDO_SIN_MEDIR',
            texto:
              'Algunas publicaciones no tienen cifras porque su creador todavía no ha conectado la cuenta de la red social. Se ve el enlace, pero no el alcance.',
          }
        : null,
      participaciones.some((p) => !p.contenido)
        ? {
            codigo: 'SIN_ENTREGA',
            texto: 'Hay colaboraciones que todavía no han entregado contenido.',
          }
        : null,
    ].filter(Boolean),
    participaciones,
  }
}

export default { informeDeCampana }
