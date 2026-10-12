# Cobros

> Hasta hoy, «el dinero queda retenido hasta que apruebas el contenido» era
> una frase. `fund` escribía una fila que decía `ESCROW_IN` y no retenía un
> euro; `release` escribía otra que decía `PAYOUT` y nadie cobraba. El 12 % se
> calculaba, se enseñaba y no se ingresaba jamás.

## Por qué cargos y transferencias separados

Hay tres formas de hacer esto con Stripe y solo una sirve:

| Forma | Por qué no |
|---|---|
| **Cargos de destino** (`transfer_data`) | El dinero sale hacia el creador en el mismo momento del cobro. No hay nada que retener. |
| **Autorizar y capturar después** | La retención de una tarjeta caduca en unos siete días. Una campaña tarda más en publicarse. |
| **Cargos y transferencias separados** | ✅ Se cobra contra la cuenta de Mikro, el dinero se queda ahí, y la transferencia al creador es una llamada aparte al aprobar. |

**Ese hueco entre las dos llamadas es, literalmente, la garantía que vende
Mikro.**

## Lo que esto NO es, y conviene no olvidarlo

**No es una cuenta escrow segregada.** El dinero cobrado vive en el saldo de
Stripe de Mikro hasta que se transfiere. `transfer_group` es solo una etiqueta
para reconciliar: no retiene nada por sí misma. Stripe tiene segregación de
fondos de verdad, pero está en acceso privado y exige condiciones que hoy no
cumplimos.

Lo que **sí** se puede decir, y es lo que dice ahora la interfaz:

> El importe se cobra ahora y no se le envía al creador hasta que apruebes.

Lo que **no** se puede decir es que esos fondos estén fuera del alcance de los
acreedores de Mikro, porque no lo están. Si algún día aparece esa frase en un
texto comercial, es falsa.

## El circuito

```
1. El creador se da de alta en Stripe (una vez)
       │  formulario de Stripe: DNI, cuenta bancaria
       │  Mikro no ve ni guarda nada de eso
       ▼
2. La empresa paga         POST /deals/:id/fund → URL de Stripe Checkout
       ▼
3. Stripe confirma         webhook checkout.session.completed → FUNDED
       ▼
4. El creador trabaja y entrega
       ▼
5. La empresa aprueba y libera   transfers.create → 88 % al creador
```

**El paso 3 es la única fuente de verdad del cobro.** No la vuelta del
navegador: si nos fiáramos de que la empresa aterrice en la página de éxito,
bastaría con escribir esa URL a mano para marcar una colaboración como pagada
sin haber pagado nada.

## Detalles que no son obvios

**`source_transaction` en la transferencia.** Ata la transferencia al cobro
concreto que la financia, así Stripe no la ejecuta hasta que ese dinero está
disponible. Sin eso, saldría del saldo general de Mikro y podría dejarlo en
descubierto.

**Claves de idempotencia** en transferencia y devolución (`payout_<dealId>`,
`refund_<dealId>`). Un corte de red reintentando no puede pagar dos veces.

**Tabla `StripeEvent`.** Stripe entrega «al menos una vez». Sin esa tabla, un
reintento del aviso de cobro registraría dos veces el mismo dinero.

**El webhook devuelve 500 si falla**, al revés que el de Shopify. Allí un 500
hace que Shopify acabe quitando la suscripción, así que se responde 200 y se
traga el error. Aquí hay dinero: prefiero que Stripe reintente a dar por bueno
un cobro que no se registró. El evento se borra de la tabla para que el
reintento no lo vea como repetido.

**No se puede pagar a quien no puede cobrar.** Si el creador no ha terminado
su alta, el intento de pago se rechaza con un mensaje que lo explica.
Enterarse de eso *después* de haberle cobrado a la empresa sería la peor forma
de descubrirlo.

**Quién paga la comisión de Stripe.** La empresa paga el importe acordado, ni
un euro más. El creador recibe el 88 %. Lo que cobra Stripe (~1,5 % + 0,25 €)
sale del 12 % de Mikro, que es justo como están hechas las cuentas del plan de
negocio: 250 € → 30 € de comisión − ~4 € de pasarela ≈ 26 € de margen.

## Sin configurar

La aplicación funciona igual, con los movimientos marcados como `SIMULATED`
— y **la interfaz lo dice**: «Pagos en modo demostración. Los importes se
anotan pero no se mueve dinero de verdad». Esa frase no es decorativa: es la
diferencia entre una demo honesta y una promesa falsa.

## Lo que falta para cobrar de verdad

1. Cuenta de Stripe y **activar Connect** (Dashboard → Connect → empezar).
2. Las tres variables de `.env.example`, en local y en Netlify.
3. El webhook apuntando a `https://TU-DOMINIO/api/stripe/webhooks` con los
   eventos `checkout.session.completed`, `payment_intent.payment_failed`,
   `account.updated` y `transfer.reversed`.
4. Probar el circuito entero en modo test con la tarjeta `4242 4242 4242 4242`.
5. Antes de cobrar de verdad: revisar con un asesor las condiciones de uso y
   quién responde de las devoluciones y los impagos. Con este montaje,
   **Mikro responde de los saldos negativos de los creadores**, y eso hay que
   saberlo antes y no después.

```bash
npm run test:stripe   # 24 pruebas, sin red: importes, firmas y estados
```

---

## El circuito, probado contra Stripe

```bash
npm run stripe:circuito
```

Recorre el camino entero en modo prueba y deja la base como estaba. **No se
teclea ningún número de tarjeta**: usa `pm_card_visa`, el método de pago de
prueba que publica Stripe.

29 comprobaciones. Las que de verdad importan:

| Comprobación | Por qué |
|---|---|
| el cobro **no lleva** `transfer_data` | Si lo llevara, el dinero saldría al creador en el acto y no habría garantía que ofrecer |
| abrir el pago **no** marca la colaboración como pagada | Solo el webhook puede hacerlo |
| un aviso repetido no cuenta dos veces | Stripe entrega al menos una vez |
| el creador no tiene nada antes de aprobar | Es literalmente la promesa del producto |
| la transferencia va atada al cobro (`source_transaction`) | Si no, saldría del saldo general de Mikro |
| pagar dos veces no paga dos veces | Clave de idempotencia |
| devolver dos veces no devuelve dos veces | Lo mismo |

### Dos cosas que encontró

**La comisión de Stripe se guardaba en euros enteros.** 3,40 € se convertía en
3 €, y cuarenta céntimos por cobro descuadran las cuentas al cabo de mil
cobros. Ahora se guarda en céntimos.

**Y casi nunca se sabe en el momento del cobro.** Stripe tarda un instante en
calcularla, así que al registrar el cobro el campo queda a `null` — no a cero,
que significaría «no costó nada». Se rellena al pagar al creador, días
después, cuando la cifra existe seguro.

### Lo que el script no prueba, y por qué

**La entrega del webhook desde Stripe.** No puede llamar a un `localhost`, así
que el script recoge el evento y se lo entrega al servidor firmado. Eso valida
nuestro código entero —firma, idempotencia, estados, importes—, pero no la
red. Esa parte se verificó aparte contra producción: un POST con una firma
inventada devuelve 400.

**El formulario de alta del creador.** Stripe no deja aceptar sus condiciones
en nombre de una cuenta Express; tiene que pulsarlas una persona. El script
comprueba lo que es nuestro (que el enlace se genera, que los requisitos se
traducen a algo legible, que mientras tanto no se puede cobrar) y deja el
formulario para quien lo tenga que rellenar.

### Si falla el paso 7

```
--  saltado: hace falta completar el perfil de plataforma en Stripe
```

Stripe pide revisar las responsabilidades de la plataforma antes de dejarte
crear cuentas cuyos requisitos recoges tú:

> https://dashboard.stripe.com/settings/connect/platform-profile

Es la pantalla donde se declara quién responde de las devoluciones y los
impagos. Hay que leerla, no solo pulsarla.

### Un detalle de la comisión en las pruebas

`pm_card_visa` es una tarjeta **estadounidense**, así que Stripe cobra la
tarifa internacional (~3,2 %) y en el circuito salen ~8 € sobre 250. Con una
tarjeta europea real son ~4 €, que es la cifra con la que están hechas las
cuentas del plan.

---

## Hacen falta dos endpoints de webhook

Esto solo apareció probando contra producción, y el fallo habría sido
silencioso.

`account.updated` de una cuenta conectada es un **evento de Connect**, y un
endpoint normal no los recibe. Stripe no permite que uno solo escuche las dos
cosas: hay que tener dos, y cada uno trae su propio secreto de firma.

| Endpoint | Marcado | Eventos |
|---|---|---|
| de la cuenta | — | `checkout.session.completed`, `payment_intent.payment_failed`, `transfer.reversed` |
| de cuentas conectadas | **connect** | `account.updated` |

Los dos apuntan a la misma URL; nuestro manejador reparte por tipo de evento.

**Qué habría pasado sin el segundo:** un creador termina su alta, Stripe la
aprueba, y en Mikro su perfil se queda para siempre en «te falta algo». Nunca
podría cobrar, ninguna empresa podría pagarle, y en los registros no habría
ningún error. Ninguna prueba local lo habría visto, porque en local el webhook
se lo entrega el propio script.

`STRIPE_WEBHOOK_SECRET` admite por eso **varios secretos separados por comas**.
La verificación prueba cada uno y basta con que valide uno; si ninguno lo hace,
se rechaza igual que antes.

```
STRIPE_WEBHOOK_SECRET="whsec_elDeLaCuenta,whsec_elDeConnect"
```

### Probarlo

```bash
npm run stripe:entrega
```

Provoca un evento real, deja que Stripe lo entregue **por internet** al
servidor desplegado y comprueba que llegó por el rastro que deja en la base.
Es lo único que no se puede probar en local, porque Stripe no llama a un
`localhost`.

Un detalle: el contador `pending_webhooks` de Stripe tarda unos segundos en
bajar a cero aunque la entrega ya haya ocurrido. La prueba espera, en vez de
dar por fallido algo que solo iba con retraso.

---

## Los planes

La suscripcion de una empresa baja su comision, y eso toca el reparto de cada
colaboracion: tres cantidades donde antes habia dos, y una factura de abono
mas. Esta en [PLANES.md](PLANES.md).

---

## PayPal

Dos cosas distintas con el mismo nombre, y conviene no mezclarlas: **pagar con
PayPal** y **cobrar en PayPal**.

### Que la empresa pague con PayPal

Va por Stripe. No es una integración aparte: se activa PayPal en los métodos de
pago de Stripe y aparece como un botón más en la página de pago. Cero código.

| Dónde | Estado |
|---|---|
| El plan (suscripción) | Funciona. Es un cargo normal de nuestra cuenta |
| Una colaboración | Necesita que Stripe lo apruebe |

El motivo del segundo es que un cobro de colaboración lleva los datos de
Connect (`transfer_group`), y Stripe responde:

> *Your Stripe account currently does not support Connect payments with PayPal.*

Mikro encaja en el caso que Stripe aprueba: su documentación dice que PayPal
está disponible para marketplaces que cobran al cliente y luego pagan a
terceros (pone Deliveroo y ManoMano de ejemplo), y que cargos y transferencias
separados —nuestro montaje— está aceptado. No está disponible para plataformas
que dan de alta a otros negocios para que cobren ellos, tipo Shopify.

**Hay que solicitarlo:** Stripe → Configuración → Métodos de pago → PayPal →
*onboarding request*. Cuando lo aprueben aparece solo, sin tocar nada.

Al configurarlo, la **preferencia de liquidación tiene que ser Stripe, no
PayPal**. Si el dinero se liquida en PayPal no entra en el saldo de Stripe, y
las transferencias a los creadores salen de ese saldo: la garantía entera se
quedaría sin fondos con los que cumplirse.

### Que el creador cobre en su PayPal

Esto sí es una integración aparte, y tiene una consecuencia que no se puede
disimular.

El dinero cobrado vive en el **saldo de Stripe**. Un pago de PayPal sale del
**saldo de PayPal**, que es otro sitio y no se llena solo: hay que mover el
dinero de Stripe al banco y del banco a PayPal. Es una operación de tesorería,
la hace una persona, y no hay API que la haga.

Por eso, cuando se aprueba el contenido de un creador que cobra por PayPal, el
pago **se encola**:

```
aprobar  ->  Payment PENDING        (no sale nada)
             npm run paypal:pagar   (lista lo que saldría)
             ... -- --enviar        (lo manda, con el saldo que haya)
             ... -- --cerrar        (pregunta si ha llegado)
```

Un pago enviado no es un pago cobrado, y por eso hay un tercer paso: entre
enviarlo y que llegue, PayPal puede rechazarlo, devolverlo o dejarlo sin
reclamar. `UNCLAIMED` es el caso que engaña: significa que ese correo no tiene
cuenta de PayPal, PayPal ya ha avisado al creador y le da 30 días. No es un
fallo todavía, así que se queda pendiente.

La interfaz le dice al creador lo que es verdad: por el banco es inmediato, por
PayPal tarda unos días.

**Lo que cuesta.** PayPal cobra al que envía, alrededor del 2% con tope. Sobre
un pago de 220 € son unos 4,40 €, y salen de la comisión de Mikro igual que la
de Stripe. Con el reparto de hoy el margen de una colaboración de 250 € pasa de
unos 26 € a unos 21. Es una decisión de negocio y está escrita aquí para que se
tome sabiéndola.

**Lo que falta para usarlo:**

1. Cuenta **business** de PayPal y pedir acceso a **Payouts** (no está abierto
   a todas las cuentas; hay que solicitarlo y lo aprueban a mano).
2. Credenciales en el `.env` y en Netlify:

```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox        # live cuando toque. Por defecto, sandbox
```

3. Saldo en la cuenta de PayPal antes de lanzar un envío.

```bash
npm run test:paypal   # 39 pruebas, sin red
```

Sin credenciales no pasa nada: la opción de PayPal no aparece en el perfil del
creador y todo el mundo cobra por el banco, como hasta ahora.
