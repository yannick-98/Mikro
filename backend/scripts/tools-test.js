/**
 * Pruebas de las herramientas: precio, facturas y brief.
 *
 *   node backend/scripts/tools-test.js
 *
 * Sin red ni base de datos. Lo que se comprueba aqui es lo que, si falla, no
 * da ningun error: una factura con el IVA mal, un precio de referencia que
 * presenta una estimacion como si fuera un dato, un brief que se come lo que
 * escribio la empresa.
 */
const { tarifaOrientativa, tramoDe, explicar, elegirNiveles, TRAMOS } = await import(
  '../src/services/pricing.js'
)
const { calcular, IVA } = await import('../src/services/invoice.js')
const { redactarBrief, PREGUNTAS } = await import('../src/services/brief.js')

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

// ---------------------------------------------------------------------------
console.log('\n--- Tramos y tarifa orientativa ---')

check('un perfil de 15K cae en 10K-30K', tramoDe(15000).id === '10k-30k')
check('uno de 900 cae en el primero', tramoDe(900).id === '1k-10k')
check('uno enorme cae en el ultimo', tramoDe(5000000).id === '150k+')
check('los tramos no dejan huecos', TRAMOS.every((t, i) => i === 0 || t.min === TRAMOS[i - 1].max))

const t20k = tarifaOrientativa({ followers: 20000, engagement: 3 })
check('20K al 3% ronda los 200 EUR', t20k.centro === 200, `${t20k.centro}`)
check('el rango abraza el centro', t20k.min < t20k.centro && t20k.max > t20k.centro)
check(
  'mas engagement, mas tarifa',
  tarifaOrientativa({ followers: 20000, engagement: 6 }).centro > t20k.centro,
)
check(
  'el engagement no dispara la tarifa sin limite',
  tarifaOrientativa({ followers: 20000, engagement: 40 }).centro <= t20k.centro * 1.5,
)
check('hay un suelo de 60 EUR', tarifaOrientativa({ followers: 300 }).centro >= 60)
check('sin datos no revienta', tarifaOrientativa().centro >= 60)

console.log('\n--- Que precision se puede prometer ---')

// Lo que fallaba: sin sector ni ciudad, el resultado se presentaba igualmente
// como "en tu sector y tu ciudad". Una cifra con la que la gente negocia no
// puede afirmar una precision que no tiene.
check('sin criterios, solo el general', elegirNiveles({}).join() === 'general')
check(
  'con tramo pero sin sector, nada de sector',
  !elegirNiveles({ tramo: { id: '10k-30k' } }).some((n) => n.includes('sector')),
)
check(
  'con sector pero sin ciudad, nada de ciudad',
  !elegirNiveles({ sector: 'Moda', tramo: {} }).some((n) => n.includes('ciudad')),
)
check(
  'con todo, se intenta lo mas fino primero',
  elegirNiveles({ sector: 'Moda', city: 'Valencia', tramo: {} })[0] === 'sector-ciudad-tramo',
)
check(
  'siempre queda el general como ultimo recurso',
  elegirNiveles({ sector: 'Moda', city: 'Valencia', tramo: {} }).at(-1) === 'general',
)

console.log('--- Como se cuenta lo que se sabe ---')

const dato = { origen: 'mercado', nivel: 'sector-ciudad-tribu', min: 180, max: 260, mediana: 220, muestra: 31 }
check('un dato de mercado cita la muestra', explicar(dato).includes('31 colaboraciones'))

const colapsado = {
  origen: 'mercado',
  nivel: 'tramo',
  tramo: '10K-30K',
  min: 250,
  max: 250,
  mediana: 250,
  muestra: 14,
  minimoVisto: 250,
  maximoVisto: 394,
}
const textoColapsado = explicar(colapsado)
check('un rango colapsado no dice "entre 250 y 250"', !textoColapsado.includes('entre 250 y 250'))
check('lo cuenta como un precio unico', textoColapsado.includes('se cerraron en 250'))
check('y ensena los extremos reales', textoColapsado.includes('de 250 a 394'))

const estimado = {
  origen: 'estimacion',
  min: 140,
  max: 280,
  nota: 'Todavía no tenemos suficientes colaboraciones cerradas con este perfil.',
}
const texto = explicar(estimado)
check('una estimacion se presenta como estimacion', texto.toLowerCase().startsWith('estimación'))
check('y lleva su aviso', texto.includes('Todavía no tenemos'))

// ---------------------------------------------------------------------------
console.log('\n--- Facturas ---')

const simple = calcular({ baseCents: 25000 })
check('IVA del 21% sobre 250 EUR son 52,50', simple.vatCents === 5250, `${simple.vatCents}`)
check('total sin retencion: 302,50', simple.totalCents === 30250, `${simple.totalCents}`)
check('sin IRPF no se resta nada', simple.irpfCents === 0)

const conIrpf = calcular({ baseCents: 25000, irpfRate: 15 })
check('IRPF del 15% son 37,50', conIrpf.irpfCents === 3750, `${conIrpf.irpfCents}`)
check('el IRPF se resta del total: 265', conIrpf.totalCents === 26500, `${conIrpf.totalCents}`)
check('el IRPF no toca la base imponible', conIrpf.baseCents === 25000)

const nuevo = calcular({ baseCents: 25000, irpfRate: 7 })
check('el 7% de los primeros anios', nuevo.irpfCents === 1750, `${nuevo.irpfCents}`)

// Los centimos son el motivo de guardar enteros: con euros esto se perderia.
const impar = calcular({ baseCents: 13333 })
check('nada de decimales perdidos', Number.isInteger(impar.vatCents) && impar.vatCents === 2800, `${impar.vatCents}`)
check(
  'base + IVA - IRPF cuadra siempre',
  [10000, 13333, 25000, 7777].every((b) => {
    const r = calcular({ baseCents: b, irpfRate: 15 })
    return r.totalCents === r.baseCents + r.vatCents - r.irpfCents
  }),
)
check('el tipo por defecto es el general', IVA === 21)

// ---------------------------------------------------------------------------
console.log('\n--- Asistente de brief ---')

const borrador = redactarBrief({
  respuestas: {
    producto: 'nuestra masa madre de espelta',
    objetivo: 'ventas',
    publico: 'familias del barrio que compran pan entre semana',
    imprescindible: 'Que se vea el interior del pan al cortarlo',
  },
  brand: { companyName: 'Panadería La Espiga', sector: 'Alimentación', city: 'Valencia' },
  campaign: { budgetMin: 150, budgetMax: 300 },
})

check('sale un titulo', borrador.titulo.length > 5, borrador.titulo)
check('el titulo menciona el producto', borrador.titulo.toLowerCase().includes('masa madre'))
check('el brief nombra la empresa', borrador.brief.includes('Panadería La Espiga'))
check('y la ciudad', borrador.brief.includes('Valencia'))
check('recoge el publico tal cual', borrador.brief.includes('familias del barrio'))
check('y lo imprescindible', borrador.brief.includes('interior del pan'))
check('propone entregables', borrador.deliverables.includes('reel'))
check('explica el dinero retenido', borrador.brief.includes('retenido'))
check('no deja puntos dobles', !borrador.brief.includes('..'))
check('sin consejos cuando todo esta bien', borrador.consejos.length === 0)

const flojo = redactarBrief({
  respuestas: { producto: 'nuestro café', objetivo: 'notoriedad' },
  brand: { companyName: 'Café Sonoro' },
  campaign: { budgetMin: 40, budgetMax: 40 },
})
check('avisa si falta el publico', flojo.consejos.some((c) => c.includes('a quién le hablas')))
check('avisa de un presupuesto bajo', flojo.consejos.some((c) => c.includes('60')))
check('avisa de un precio cerrado', flojo.consejos.some((c) => c.includes('rango')))
check('aun sin publico produce un brief', flojo.brief.length > 150)

// El titulo salia cortado a mitad de palabra ("...recién salida…") y con la
// ciudad pegada detras de los puntos suspensivos.
const titulo = (producto, objetivo = 'notoriedad') =>
  redactarBrief({
    respuestas: { producto, objetivo },
    brand: { companyName: 'Prueba' },
    campaign: { targetCity: 'Valencia' },
  }).titulo

check('el titulo no parte palabras', !/\w…$/.test(titulo('nuestra masa madre de espelta, recién salida del horno')))
check(
  'se queda con el primer inciso',
  titulo('nuestra masa madre de espelta, recién salida del horno', 'ventas') ===
    'Da a conocer nuestra masa madre de espelta',
)
check('ningun titulo pasa de 60 caracteres', [
  'nuestra masa madre de espelta, recién salida del horno',
  'el nuevo gimnasio del barrio de Russafa con su sala de ciclo indoor y entrenadores',
  'la colección de otoño',
].every((p) => titulo(p).length <= 60))
check(
  'un titulo recortado no lleva la ciudad detras',
  !titulo('el nuevo gimnasio del barrio de Russafa con su sala de ciclo indoor').includes('…, en'),
)
check('empieza por mayuscula', /^[A-ZÁÉÍÓÚÑ]/.test(titulo('nuestra tienda de flores')))

check('las preguntas requeridas son tres', PREGUNTAS.filter((p) => p.requerida).length === 3)
check(
  'cada objetivo tiene su texto',
  ['ventas', 'notoriedad', 'lanzamiento', 'contenido'].every(
    (o) => redactarBrief({ respuestas: { producto: 'x', objetivo: o } }).brief.length > 100,
  ),
)

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
