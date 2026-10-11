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
