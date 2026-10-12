# Los planes de suscripción

> Lo único que cambia un plan es la comisión. **El creador cobra lo mismo
> tenga la empresa el plan que tenga.**

| Plan | Precio | Comisión | Compensa a partir de |
|---|---|---|---|
| Gratis | 0 € | 12% | — |
| Pro | 29 €/mes | 9% | 967 €/mes en colaboraciones |
| Agencia | 99 €/mes | 6% | 1.650 €/mes |

## El problema que hubo que resolver antes de construirlo

Tal y como estaba el producto, la comisión **salía del pago al creador**: la
empresa pagaba 250 €, el creador recibía 220 € y Mikro se quedaba 30 €. Pero
el registro se la vendía a la empresa: «Comisión del 12%, sin letra pequeña».

Eso hacía imposible el plan tal y como se pedía. Si un plan de empresa «baja
la comisión», lo que ocurre mecánicamente es que **el creador cobra más y
Mikro cobra menos**: la empresa paga exactamente lo mismo y no gana nada por
sus 29 € al mes. El plan no valdría nada.

La decisión fue: **la empresa paga menos y el creador cobra igual**.

```
Colaboración de 250 € pactados

                 Empresa paga   Creador cobra   Mikro
Gratis  (12%)        250,00 €        220,00 €   30,00 €
Pro     (9%)         242,50 €        220,00 €   22,50 €
Agencia (6%)         235,00 €        220,00 €   15,00 €
```

El creador no se entera de nada, y es deliberado: su acuerdo no puede moverse
porque su cliente haya contratado algo por su cuenta.

## Cómo cuadra eso en las facturas

Aquí está la parte que parece rara y no lo es. El creador **sigue facturando
su caché íntegro** y **sigue pagando su 12%**. Lo que compra la empresa es que
Mikro le devuelva unos puntos, y eso es un abono de Mikro a la empresa:

| Documento | Serie | Importe (ejemplo Pro) |
|---|---|---|
| Creador → Empresa | C2026 | 250,00 € |
| Mikro → Creador (comisión) | M2026 | 30,00 € |
| Mikro → Empresa (descuento del plan) | A2026 | −7,50 € |

Caja: la empresa paga 250 − 7,50 = **242,50**. El creador cobra 250 − 30 =
**220**. A Mikro le quedan 30 − 7,50 = **22,50**. Cuadra.

Cualquier otra forma de contarlo deja las facturas sin corresponderse con el
dinero que se mueve. Si en vez de un abono se bajara la comisión del creador,
él cobraría más —que no es lo que se vende—; si se bajara su caché, cobraría
menos, que es peor.

Los abonos van en **serie propia (A)**. Meterlos en la serie de facturas
emitidas rompería la correlatividad que exige Hacienda.

## Tres cantidades donde antes había dos

En `Deal`:

| Campo | Qué es |
|---|---|
| `fee` | El caché pactado. De lo que hablan la empresa y el creador |
| `feePlatform` | La comisión del creador. **Siempre la base (12%)** |
| `creatorNet` | Lo que cobra el creador. Nunca depende del plan |
| `platformPct` | El porcentaje de Mikro para este trato, congelado |
| `brandTotalCents` | Lo que se le cobra a la empresa, **en céntimos** |

En céntimos porque ahí aparecen los medios euros: el 3% de 250 son 7,50, y
redondear eso a 8 es regalar cincuenta céntimos en cada colaboración. Por lo
mismo `Payment` tiene `amountCents`.

### Todo esto se congela al cerrar la colaboración

`platformPct` se guarda en el trato, no se lee del plan actual. Sin eso, una
empresa que se suscribe en octubre vería recalculada a la baja la comisión de
las ventas de una campaña cerrada en agosto, y una que se da de baja la vería
subir. Las dos cosas son reescribir dinero que dos partes ya habían pactado.

Importa sobre todo en el pago por resultado, donde el variable se liquida
meses después según lo que venda el código del creador.

## La recomendación sabe decir que no

`recomendar(gastoMensual)` devuelve el plan con el coste total más bajo para
ese gasto, y eso incluye **recomendar bajarse de plan**.

No es generosidad. Un comparador que solo recomienda hacia arriba es un
anuncio, y el día que un cliente hace la cuenta y ve que lleva medio año
pagando de más, lo que se pierde no son 29 € al mes. Por la misma razón la
tabla enseña los ahorros negativos tal cual: una tabla en la que todos los
números son buenos no la cree nadie.

Con menos de dos colaboraciones en el último mes se usa un gasto de ejemplo y
se dice que lo es: una sola colaboración de 2.000 € recomendaría Agencia a
quien no va a repetir.

## Por qué no hay funciones detrás del plan

Lo fácil es inventarse tres niveles y repartir funciones entre ellos, porque
así la tabla se rellena sola. El problema es que convierte el producto en una
negociación: la empresa deja de preguntarse si Mikro le sale a cuenta y
empieza a preguntarse qué le estamos escondiendo. Y para esconder algo hay que
empeorar a propósito el plan gratuito, que es justo el que tiene que enamorar
a quien todavía no se fía.

Con una sola variable la pregunta es aritmética y se contesta sin vendedor.

## Lo que pasa cuando algo falla

| Situación | Qué hacemos |
|---|---|
| La tarjeta falla (`past_due`) | **No se toca el plan.** Se avisa. Stripe reintenta varios días |
| Stripe cancela de verdad | Vuelve al 12%, sin castigo |
| Se da de baja | Mantiene su comisión hasta el final del mes pagado |
| Cambia de plan | Va al portal de Stripe, que prorratea lo ya pagado |

Subirle la comisión a alguien en mitad de una campaña por un cobro que todavía
puede salir sería cobrarle de más por un problema de su banco.

## Montarlo

```bash
npm run planes:alta     # crea productos y precios en Stripe, y añade los
                        # eventos de suscripción al webhook. Idempotente.
npm run test:planes     # 65 pruebas, sin red: es donde está el dinero
npm run planes:circuito # 17 comprobaciones contra Stripe y contra producción
```

El circuito es lo único que no se puede probar en local, porque Stripe no
llama a un localhost. Contrata un plan con una tarjeta de prueba, deja que el
aviso viaje por internet hasta el servidor desplegado, comprueba que la
comisión de esa empresa ha bajado, cancela y comprueba que vuelve. Deja la
base y Stripe como estaban.

Hace falta una vez en pruebas y otra en real: son dos mundos separados con
objetos distintos.

Los precios se buscan por `lookupKey` (`mikro_pro_mensual`,
`mikro_agencia_mensual`) y no por su `price_...`. Así no hay que guardar
identificadores de Stripe en variables de entorno, que es como se acaba con
dos variables por plan sin saber cuál es de cuál. Si alguien borra un precio,
volver a lanzar el script lo recrea con la misma llave.

PayPal funciona aquí desde el primer día: una suscripción es un cargo normal
de nuestra cuenta, sin los datos de Connect que son los que obligan a pedirle
permiso a Stripe (ver [COBROS.md](COBROS.md)).

## Pendiente

- Facturación anual con descuento. Son otro precio con la misma `lookupKey`
  más `_anual`, y `asegurarPrecios()` ya sabría crearlo.
- Periodo de prueba. `trialing` ya cuenta como plan vivo, así que es añadir
  `trial_period_days` al crear la suscripción.
- Avisar por correo cuando la recomendación cambia, sobre todo cuando cambia
  hacia abajo: es el momento en que más se gana diciéndolo.
