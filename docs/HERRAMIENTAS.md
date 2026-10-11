# Las herramientas del día a día

Cuatro cosas que convierten datos que Mikro ya tenía y nadie usaba en una
respuesta que hoy el usuario no sabe buscar, más dos que quitan fricción
donde se cae la gente.

---

## 1. Precio de referencia

**El problema.** Es el bloqueo número uno de los dos lados del mercado: la
pyme no sabe si 300 € es caro y el creador no sabe qué pedir. La respuesta
solo la tiene quien ve lo que se cierra, y eso es exactamente lo que Mikro
acumula en cada colaboración.

**Dónde aparece.** En el formulario de campaña, junto al presupuesto, y en el
de candidatura, junto a la tarifa. Ahí y no en un artículo del blog: la cifra
tiene que estar delante en el momento exacto en el que alguien decide un
número.

**Cómo se calcula** (`services/pricing.js`). Va bajando de precisión hasta
encontrar muestra:

```
sector + ciudad + tramo  ->  sector + tramo  ->  tramo  ->  general
```

Dos reglas que gobiernan todo el módulo:

- **Solo se intentan los niveles cuyos criterios nos han dado.** Si nadie nos
  dijo el sector, el resultado no puede presentarse como «en tu sector»: sería
  afirmar una precisión que no existe, y en una cifra con la que la gente
  negocia eso no es un matiz.
- **Por debajo de ocho colaboraciones no hay dato de mercado.** Se devuelve
  una estimación (≈10 € por mil seguidores, corregida por engagement), se
  llama estimación y se pinta en otro color. Un rango inventado con tres
  muestras es peor que ninguno, porque la gente lo usa para negociar y el
  ancla la habremos puesto nosotros.

El rango que se enseña son los cuartiles 25–75, no el mínimo y el máximo. Y si
los tres cuartiles coinciden —mercado concentrado— se dice «casi todas se
cerraron en X €» en vez de «entre X y X €», que se lee como un fallo.

---

## 2. Informe de campaña

**El problema.** Una pyme paga 250 €, recibe un reel y no sabe nada más. Nadie
repite lo que no puede mirar, y la primera palanca de LTV del plan de negocio
es justamente la frecuencia.

**Tres fuentes y no se mezclan** (`services/report.js`):

| Qué | De dónde | Exactitud |
|---|---|---|
| Lo que costó | Las colaboraciones | Exacto |
| Lo que se publicó | Las publicaciones reales del creador | Solo si tiene la cuenta conectada |
| Lo que vendió | Atribución de Shopify | Solo si la tienda está conectada |

**La regla de la pantalla: un hueco nunca se pinta como un cero.** Si una
publicación no tiene cifras, se dice que su creador no ha conectado la cuenta.
Si no hay ventas, se dice que no hay tienda conectada. Un informe que rellena
huecos con suposiciones no sirve para decidir, que es para lo único que
existe.

Lo entregado se casa con la publicación real comparando el permalink sin
parámetros ni dominio móvil, porque las URLs que pega la gente vienen con de
todo.

---

## 3. Media kit público

`/kit/<handle>`, sin sesión, para pegar en una bio.

Resuelve algo escrito en la tesis del negocio: el micro-influencer «no tiene
forma de demostrar su valor más allá de una captura de pantalla de sus
estadísticas». Y de paso es un bucle de captación: cada creador que lo
comparte trae gente a Mikro sin coste.

Enseña lo que ya está en su ficha, más sus mejores publicaciones reales y lo
que han vendido sus códigos. Para un micro-influencer eso último no es una
métrica más: es el único argumento que convierte «tengo 20.000 seguidores» en
«traigo clientes».

Las tarifas se incluyen a propósito. El motivo de existir de la página es que
una marca pueda decidir sin escribir un DM a ciegas, que es el problema que
Mikro resuelve.

---

## 4. Asistente de brief

Cuatro preguntas y un borrador editable (`services/brief.js`).

**Sin modelo de lenguaje, a propósito.** Un brief generado por IA suena a
brief generado por IA, cuesta dinero en cada campaña y falla cuando la API
está caída. Una plantilla buena se lee mejor y nunca se inventa el producto de
nadie.

Además avisa de lo que va a salir mal antes de que salga: un brief sin público
trae candidaturas que no encajan; un presupuesto por debajo de 60 € no recibe
casi ninguna; un precio cerrado en vez de un rango espanta a los buenos.

---

## 5. Entregas con versión y comentarios

Antes la empresa solo podía aprobar o no hacer nada. **No hacer nada con el
dinero retenido es la peor forma posible de decir que algo no encaja**: el
creador se queda esperando sin saber qué arreglar.

Ahora cada entrega es una versión y la respuesta de la empresa queda escrita
junto a la versión concreta a la que se refiere. Es la conversación que decide
si se suelta el dinero, así que conviene tenerla fechada y por escrito: evita
la mitad de las disputas.

---

## 6. Facturas

Un creador que cobra es un autónomo que tiene que emitir factura, y hoy lo
resuelve a mano un domingo por la noche. Son dos documentos y no conviene
confundirlos:

- **CREATOR_TO_BRAND**: el creador factura su trabajo. IVA del 21 % y, si lo
  indica, retención de IRPF (15 % habitual, 7 % los tres primeros años).
- **MIKRO_COMMISSION**: Mikro factura su comisión al creador.

Todo en **céntimos y enteros**. El resto del modelo usa euros redondos porque
las tarifas lo son, pero el 21 % de 250 son 52,50 y una factura que redondea
eso está mal emitida.

Se emiten al **aprobar** y no al pagar: el trabajo hecho y aceptado es el hecho
que las devenga. La emisión es idempotente, porque una factura duplicada no es
un detalle cosmético.

**Lo que esto no es:** no sustituye a una asesoría ni lleva el libro de
facturas emitidas. Para Verifactu y el resto de obligaciones formales hace
falta más, y está dicho en la propia pantalla.

---

## 7. Avisos por WhatsApp

Una pyme española no vive en el correo. El cuello de botella del embudo no es
que falten candidaturas, es que pasan días hasta que alguien las mira.

Tres reglas:

- **Solo con permiso expreso.** La casilla nunca viene marcada.
- **Solo lo que no puede esperar**: candidaturas, colaboraciones y
  invitaciones. Fuera quedan los mensajes de chat y las valoraciones: veinte
  WhatsApps en una tarde es la forma más rápida de que alguien quite el
  permiso y no lo vuelva a dar.
- **Un fallo al enviar no rompe la acción.** Que WhatsApp esté caído no puede
  impedir que alguien acepte una candidatura.

Sin credenciales configuradas, Mikro funciona igual.

---

## Pruebas

```bash
npm run test:tools    # precio, facturas y brief — 52, sin red ni base de datos
npm run test:social   # métricas y cifrado — 39
npm run test:shopify  # firmas, tokens y enlaces — 55
npm test              # las tres
```

---

## 8. Qué se promociona y cómo se paga

Una campaña dice ahora si promociona **un producto** o **un servicio**, y en
las de producto la empresa elige cómo paga:

| Modelo | Qué cobra el creador |
|---|---|
| **Fijo** | Un importe acordado, pase lo que pase |
| **Fijo + comisión** | Un importe seguro más un % de lo que venda |
| **Solo comisión** | Únicamente un % de lo que venda |

### Las tres reglas que gobiernan esto

**1. La comisión exige tienda conectada.** Se calcula sobre las ventas
atribuidas al código del creador, que es justo lo que mide la app de Shopify.
Sin tienda esa cifra no existe, así que las opciones con variable se
desactivan y se dice por qué. No es un requisito técnico que nos venga bien:
es la única forma de que el número exista. Dejar publicar una oferta que luego
nadie puede liquidar sería la peor manera de estrenar un modelo de pago.

**2. Los servicios solo pagan fijo.** Una clase de yoga también se vende, pero
hoy no sabemos medir esa venta. Prometer una comisión sobre algo que no vamos
a poder contar es una promesa que se rompe delante del creador.

**3. Lo seguro y lo variable no se suman nunca en la interfaz.** `repartoDeal`
devuelve las dos partes por separado y un campo `garantizado`, y las pantallas
las pintan separadas. Enseñar «100 € + 10%» como si fueran 250 sería venderle
a alguien una expectativa como si fuera un sueldo. En las campañas sin fijo se
le dice al creador, con esas palabras, que si no vende no cobra.

Las condiciones se **congelan en la colaboración** al aceptar la candidatura.
La campaña puede cambiar mañana; el trato cerrado con esa persona, no.

La comisión se calcula sobre la venta **neta de devoluciones**: pagar sobre un
pedido que la tienda ha tenido que reintegrar sería el peor error posible en
una cifra que decide a quién se paga. Una devolución mayor que la venta deja
el variable en cero, nunca en negativo.

### El descuento del código

La campaña fija también **qué descuento llevará el código** del creador. Vive
aquí y no en los ajustes de la tienda porque es una decisión comercial
concreta: la misma marca hace un 10 % en una campaña y un 25 % en una
liquidación. Cuando se crea el código desde el admin de Shopify, ese es el
valor de partida; el ajuste general de la tienda queda como última red.

Para el creador no es un detalle administrativo, es su argumento de venta, así
que aparece en la oferta que ve antes de postularse.

**Y una cuenta que casi nadie hace hasta que es tarde:** el descuento sale del
precio y la comisión sale de lo que queda, así que no se suman, se multiplican.
El formulario la hace en voz alta mientras escribes — «de cada 100 €, el
cliente paga 70 y de ahí salen 7 para el creador; te quedan 63» — y rechaza
las combinaciones que no dejan margen.

---

## 9. La ficha del producto y su envío

### Qué se promociona

Las campañas de producto llevan ficha: nombre, referencia, enlace en la
tienda, imagen y valor. Antes el creador tenía que deducir el producto
leyendo el brief, y a veces lo deducía mal: se postulaba a algo que no era, o
describía en el vídeo un producto equivocado.

El enlace no es decorativo. Es el destino natural del enlace que después
comparte el creador, así que ponerlo aquí ahorra escribirlo otra vez al crear
el código.

### El envío

`shipsProduct` es una casilla aparte del valor cedido, porque son cosas
distintas: se puede ceder sin enviar (una cena, una clase) y se puede enviar
sin ceder (una muestra que vuelve).

Cuando la campaña envía producto, la colaboración arranca con el envío
**pendiente** desde el minuto uno, en vez de aparecer cuando alguien se
acuerda. A partir de ahí, cada lado marca lo suyo:

```
PENDING ──(el creador da su dirección)──> PENDING
        ──(la empresa marca enviado)────> SENT
        ──(el creador confirma)─────────> RECEIVED
```

**Ninguno de los dos puede marcar lo del otro, y eso es el punto.** La
discusión clásica es «yo lo mandé» contra «no me ha llegado»; que cada uno
marque su parte deja constancia de quién dijo qué y cuándo, y evita que el
creador aparezca como que no entrega cuando lo que pasa es que no ha recibido
nada. La prueba de humo comprueba los cuatro intentos cruzados, no solo el
camino feliz.

**La dirección vive en la colaboración, no en el perfil del creador.** Es su
casa: solo tiene que verla la empresa con la que ya ha cerrado un trato que
exige mandarle algo.

### El cupón también puede ser envío gratis

`discountType` es `PERCENTAGE` o `FREE_SHIPPING`. No es una variante menor del
descuento: en Shopify es **otra mutación** (`discountCodeFreeShippingCreate`,
no `discountCodeBasicCreate`), porque un envío gratis no toca el precio del
producto sino el del envío.

Como palanca comercial tampoco es lo mismo: convierte mejor que un 5 % en
carritos pequeños y a la tienda le cuesta menos que rebajar el producto.

En envío gratis el porcentaje se guarda a cero a propósito. Arrastrar un
número que no se aplica acabaría pintándose como «0 %» en algún panel, que es
justo lo contrario de lo que hace el código.
