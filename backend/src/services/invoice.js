/**
 * Facturas de una colaboracion.
 *
 * Un creador que cobra es un autonomo que tiene que emitir factura, y hoy eso
 * lo resuelve por su cuenta, tarde y a menudo mal. La pyme, por su parte,
 * necesita un documento para su contabilidad. Las dos cosas las tiene Mikro:
 * sabe quien, a quien, cuanto y por que.
 *
 * Son dos documentos distintos y confundirlos es un problema contable:
 *
 *  - CREATOR_TO_BRAND: el creador factura su trabajo a la empresa. Lleva IVA
 *    del 21% y, si el creador lo indica, retencion de IRPF (habitual: 15%;
 *    7% durante los tres primeros anios de actividad).
 *  - MIKRO_COMMISSION: Mikro factura su comision al creador. IVA del 21% y
 *    sin retencion, porque la emite una empresa.
 *
 * Todo en centimos y con enteros. El resto del modelo usa euros redondos
 * porque las tarifas lo son, pero el 21% de 250 son 52,50 y una factura que
 * redondea eso esta mal emitida.
 *
 * Aviso honesto: esto genera el documento con los datos y los calculos
 * correctos. No sustituye a una asesoria ni lleva el libro de facturas
 * emitidas; para Verifactu y el resto de obligaciones formales hace falta
 * algo mas, y conviene decirlo en la propia pantalla.
 */
import { prisma } from '../lib/prisma.js'

export const IVA = 21

const centimos = (euros) => Math.round(euros * 100)

/** Calcula las lineas de una factura. Puro, para poder probarlo. */
export function calcular({ baseCents, vatRate = IVA, irpfRate = 0 }) {
  const vatCents = Math.round((baseCents * vatRate) / 100)
  const irpfCents = Math.round((baseCents * irpfRate) / 100)
  // El IRPF se resta del total: no es menos base, es menos dinero a cobrar,
  // porque lo ingresa el cliente en Hacienda por cuenta del creador.
  return { baseCents, vatRate, vatCents, irpfRate, irpfCents, totalCents: baseCents + vatCents - irpfCents }
}

/**
 * Siguiente numero de una serie.
 *
 * Correlativo y sin huecos dentro del ano, que es lo que exige Hacienda. Se
 * calcula mirando el ultimo emitido de esa serie: con el volumen de Mikro no
 * hace falta nada mas sofisticado, y la clave unica de la tabla impide que dos
 * peticiones simultaneas acaben con el mismo numero.
 */
async function siguienteNumero(series) {
  const ultima = await prisma.invoice.findFirst({
    where: { series },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const n = ultima ? Number(ultima.number.split('-')[1]) + 1 : 1
  return `${series}-${String(n).padStart(4, '0')}`
}

/**
 * Emite las facturas de una colaboracion, si no estaban ya.
 *
 * Idempotente a proposito: se llama al aprobar el contenido, y aprobar dos
 * veces no debe duplicar una factura. Una factura duplicada no es un error
 * cosmetico, es un problema con Hacienda.
 */
export async function emitirFacturas(dealId) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      campaign: { select: { title: true } },
      brand: { include: { user: { select: { name: true } } } },
      creator: { include: { user: { select: { name: true } } } },
      invoices: true,
    },
  })
  if (!deal) throw new Error('Esa colaboración no existe')

  const anio = new Date().getFullYear()
  const emitidas = []

  // --- Factura del creador a la empresa -----------------------------------
  if (!deal.invoices.some((i) => i.kind === 'CREATOR_TO_BRAND')) {
    const lineas = calcular({
      baseCents: centimos(deal.fee),
      irpfRate: deal.creator.irpfRate || 0,
    })
    emitidas.push(
      await prisma.invoice.create({
        data: {
          dealId: deal.id,
          kind: 'CREATOR_TO_BRAND',
          series: `C${anio}`,
          number: await siguienteNumero(`C${anio}`),
          issuerName: deal.creator.user?.name || deal.creator.displayName,
          issuerTaxId: deal.creator.taxId || null,
          issuerAddress: deal.creator.billingAddress || null,
          clientName: deal.brand.companyName,
          clientTaxId: deal.brand.vatNumber || null,
          clientAddress: deal.brand.billingAddress || null,
          concept: `Colaboración de contenido — ${deal.campaign.title}`,
          ...lineas,
        },
      }),
    )
  }

  // --- Factura de Mikro al creador por la comision ------------------------
  if (deal.feePlatform > 0 && !deal.invoices.some((i) => i.kind === 'MIKRO_COMMISSION')) {
    // La comision ya se descuenta del importe que recibe el creador, asi que
    // la base de esta factura es esa comision y nada mas.
    const lineas = calcular({ baseCents: centimos(deal.feePlatform) })
    emitidas.push(
      await prisma.invoice.create({
        data: {
          dealId: deal.id,
          kind: 'MIKRO_COMMISSION',
          series: `M${anio}`,
          number: await siguienteNumero(`M${anio}`),
          issuerName: process.env.MIKRO_LEGAL_NAME || 'Mikro',
          issuerTaxId: process.env.MIKRO_TAX_ID || null,
          issuerAddress: process.env.MIKRO_ADDRESS || null,
          clientName: deal.creator.user?.name || deal.creator.displayName,
          clientTaxId: deal.creator.taxId || null,
          clientAddress: deal.creator.billingAddress || null,
          concept: `Comisión de intermediación — ${deal.campaign.title}`,
          ...lineas,
        },
      }),
    )
  }

  return emitidas
}

/** Forma publica: los centimos se devuelven tambien en euros ya formateados. */
export function publicInvoice(i) {
  if (!i) return null
  const euros = (c) => Math.round(c) / 100
  return {
    id: i.id,
    dealId: i.dealId,
    kind: i.kind,
    number: i.number,
    issuedAt: i.issuedAt,
    issuer: { name: i.issuerName, taxId: i.issuerTaxId, address: i.issuerAddress },
    client: { name: i.clientName, taxId: i.clientTaxId, address: i.clientAddress },
    concept: i.concept,
    base: euros(i.baseCents),
    vatRate: i.vatRate,
    vat: euros(i.vatCents),
    irpfRate: i.irpfRate,
    irpf: euros(i.irpfCents),
    total: euros(i.totalCents),
  }
}

export default { emitirFacturas, calcular, publicInvoice, IVA }
