/**
 * Pruebas de los planes y del reparto del dinero.
 *
 *   node backend/scripts/planes-test.js
 *
 * Sin red y sin base de datos. Esto es lo que decide cuanto paga cada uno, y
 * un error aqui no da ninguna senal: simplemente alguien cobra de menos todos
 * los meses y lo descubre su asesoria, no nosotros.
 */
process.env.PLATFORM_FEE_PCT = '12'

const {
  PLANES,
  COMISION_BASE,
  comisionDe,
  importesDe,
  desgloseDe,
  umbralDe,
  recomendar,
  comparar,
  planPorId,
} = await import('../src/billing/planes.js')

let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    passed += 1
    console.log(`  OK   ${name}`)
  } else {
    failed += 1
    console.log(`  FALLO ${name} ${extra}`)
  }
}

const euros = (c) => c / 100

// ---------------------------------------------------------------------------
console.log('\n--- El reparto, con la tabla que se decidio ---')

// 250 pactados. El creador cobra 220 pase lo que pase; lo que cambia es lo
// que paga la empresa.
const casos = [
  { plan: 'FREE', pct: 12, empresa: 250.0, creador: 220, mikro: 30.0, descuento: 0 },
  { plan: 'PRO', pct: 9, empresa: 242.5, creador: 220, mikro: 22.5, descuento: 7.5 },
  { plan: 'AGENCIA', pct: 6, empresa: 235.0, creador: 220, mikro: 15.0, descuento: 15.0 },
]

for (const c of casos) {
  const r = importesDe(250, c.pct)
  check(`${c.plan}: la empresa paga ${c.empresa} €`, euros(r.brandCents) === c.empresa, euros(r.brandCents))
  check(`${c.plan}: el creador cobra ${c.creador} €`, r.creatorNet === c.creador, r.creatorNet)
  check(`${c.plan}: a Mikro le quedan ${c.mikro} €`, euros(r.mikroCents) === c.mikro, euros(r.mikroCents))
  check(`${c.plan}: el descuento es ${c.descuento} €`, euros(r.descuentoCents) === c.descuento)
}

console.log('\n--- Lo que no puede cambiar nunca ---')

// Si esto falla, el plan de una empresa le estaria cambiando el sueldo a un
// creador que no ha firmado nada de eso.
const netos = PLANES.map((p) => importesDe(250, p.comision).creatorNet)
check('el creador cobra lo mismo con los tres planes', new Set(netos).size === 1, netos.join('/'))

const netos2 = PLANES.map((p) => importesDe(837, p.comision).creatorNet)
check('tambien con un importe que no es redondo', new Set(netos2).size === 1, netos2.join('/'))

// Y si esto falla, hay dinero que aparece o desaparece por el camino.
for (const p of PLANES) {
  const r = importesDe(837, p.comision)
  check(
    `${p.id}: lo que paga la empresa es lo del creador mas lo de Mikro`,
    r.creatorNet * 100 + r.mikroCents === r.brandCents,
    `${r.creatorNet * 100} + ${r.mikroCents} != ${r.brandCents}`,
  )
}

console.log('\n--- Los medios euros ---')

// El 3% de 250 son 7,50. En euros enteros se perderian 50 centimos por
// colaboracion, siempre a favor del mismo.
const pro = importesDe(250, 9)
check('el descuento guarda los centimos', pro.descuentoCents === 750, pro.descuentoCents)
check('y lo que paga la empresa tambien', pro.brandCents === 24250, pro.brandCents)

const raro = importesDe(333, 9)
check('con 333 € el descuento son 9,99', euros(raro.descuentoCents) === 9.99, euros(raro.descuentoCents))
check('la empresa paga 323,01', euros(raro.brandCents) === 323.01, euros(raro.brandCents))
check('el creador cobra 293', raro.creatorNet === 293, raro.creatorNet)

console.log('\n--- Colaboraciones anteriores a los planes ---')

// Las que no tienen las columnas nuevas se cerraron todas al 12% y sin
// descuento. Si esto se leyera mal, una colaboracion vieja cambiaria de
// importe sola.
const vieja = desgloseDe({ fee: 250, feePlatform: 30, brandTotalCents: 0, creatorNet: 0 })
check('la empresa pago el cache', euros(vieja.brandCents) === 250)
check('el creador cobro 220', vieja.creatorNet === 220)
check('sin descuento', vieja.descuentoCents === 0)
check('y a Mikro le quedaron 30', euros(vieja.mikroCents) === 30)

const nueva = desgloseDe({ fee: 250, feePlatform: 30, brandTotalCents: 24250, creatorNet: 220 })
check('una con plan se lee tal cual', euros(nueva.brandCents) === 242.5)
check('con su descuento', euros(nueva.descuentoCents) === 7.5)
check('y la comision de Mikro sale de la resta', euros(nueva.mikroCents) === 22.5)

console.log('\n--- Que comision le toca a cada empresa ---')

check('sin plan, la base', comisionDe({ plan: 'FREE' }) === 12)
check('sin nada, la base', comisionDe({}) === 12)
check('sin empresa, la base', comisionDe(null) === 12)
check('Pro activo, 9', comisionDe({ plan: 'PRO', planStatus: 'active' }) === 9)
check('Agencia activo, 6', comisionDe({ plan: 'AGENCIA', planStatus: 'active' }) === 6)
check('en periodo de prueba cuenta', comisionDe({ plan: 'PRO', planStatus: 'trialing' }) === 9)

// A quien se le ha caducado la tarjeta se le avisa, no se le sube la comision
// en mitad de una campana: Stripe reintenta varios dias antes de cancelar.
check('con un recibo impagado sigue valiendo', comisionDe({ plan: 'PRO', planStatus: 'past_due' }) === 9)
check('cancelado vuelve a la base', comisionDe({ plan: 'PRO', planStatus: 'canceled' }) === 12)
check('impagado del todo, a la base', comisionDe({ plan: 'PRO', planStatus: 'unpaid' }) === 12)
// Un plan guardado sin estado no puede valer: seria plan gratis.
check('un plan sin estado no cuenta', comisionDe({ plan: 'AGENCIA' }) === 12)

console.log('\n--- A partir de cuanto compensa ---')

const umbralPro = umbralDe(planPorId('PRO'))
const umbralAgencia = umbralDe(planPorId('AGENCIA'))
check('Pro compensa a partir de 967 €/mes', umbralPro === 967, umbralPro)
check('Agencia, a partir de 1.650 €/mes', umbralAgencia === 1650, umbralAgencia)
check('el gratuito no tiene umbral', umbralDe(planPorId('FREE')) === null)

// Comprobacion de que el umbral es de verdad el punto de corte.
const justoDebajo = comparar(umbralPro - 100).find((p) => p.id === 'PRO')
const justoEncima = comparar(umbralPro + 100).find((p) => p.id === 'PRO')
check('por debajo del umbral, Pro sale a perder', justoDebajo.ahorro < 0, `${justoDebajo.ahorro}`)
check('por encima, a ganar', justoEncima.ahorro > 0, `${justoEncima.ahorro}`)

console.log('\n--- La recomendacion, que tiene que saber decir que no ---')

check('quien no gasta nada, gratis', recomendar(0) === planPorId('FREE') || recomendar(0).id === 'FREE')
check('400 €/mes, gratis', recomendar(400).id === 'FREE', recomendar(400).id)
check('900 €/mes, todavia gratis', recomendar(900).id === 'FREE', recomendar(900).id)
check('1.500 €/mes, Pro', recomendar(1500).id === 'PRO', recomendar(1500).id)
check('3.000 €/mes, Agencia', recomendar(3000).id === 'AGENCIA', recomendar(3000).id)
check('10.000 €/mes, Agencia', recomendar(10000).id === 'AGENCIA', recomendar(10000).id)

// Esta es la que justifica que exista la funcion: poder decirle a alguien que
// se baje de plan. Un comparador que solo recomienda hacia arriba es un
// anuncio, y el dia que el cliente hace la cuenta, lo que se pierde no son
// 29 euros al mes.
check('a un Agencia que ya no gasta se le recomienda gratis', recomendar(200).id === 'FREE')
check('y a uno que gasta poco, Pro antes que Agencia', recomendar(1700).id === 'PRO', recomendar(1700).id)

console.log('\n--- La tabla que se le ensena a la empresa ---')

const tabla = comparar(2000)
check('salen los tres planes', tabla.length === 3)
const proFila = tabla.find((p) => p.id === 'PRO')
check('el coste de Pro con 2.000 € son 209 €', proFila.costeMensual === 209, proFila.costeMensual)
check('y ahorra 31 € frente a no tener plan', proFila.ahorro === 31, proFila.ahorro)
check('el gratuito no ahorra nada respecto a si mismo', tabla.find((p) => p.id === 'FREE').ahorro === 0)

// Un ahorro negativo se ensena igual: una tabla en la que todos los numeros
// son buenos no la cree nadie.
const pobre = comparar(300).find((p) => p.id === 'AGENCIA')
check('con poco gasto, Agencia sale negativo y se dice', pobre.ahorro < 0, `${pobre.ahorro}`)

console.log('\n--- Coherencia del catalogo ---')

check('la base es 12', COMISION_BASE() === 12)
check('el gratuito es el primero', PLANES[0].id === 'FREE')
check('el gratuito no cuesta nada', PLANES[0].precio === 0)
check('ningun plan cobra mas comision que la base', PLANES.every((p) => p.comision <= COMISION_BASE()))
check('a mas precio, menos comision', PLANES.every((p, i) => i === 0 || p.comision < PLANES[i - 1].comision))
check('los de pago tienen llave en la pasarela', PLANES.filter((p) => p.precio > 0).every((p) => p.lookupKey))
check('el gratuito no', PLANES[0].lookupKey === null)
check('un id que no existe cae en el gratuito', planPorId('NO_EXISTE').id === 'FREE')

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
