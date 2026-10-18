# Diagnóstico de la web de una empresa

Una pyme escribe su dirección y recibe un informe del estado de su web: nota
sobre cien, lo primero que habría que arreglar ordenado por lo que recupera
cada cosa, y la respuesta a la pregunta que de verdad nos incumbe —**¿esta web
aguanta el tráfico que le traería un creador?**

Es público y no pide cuenta, igual que el precio de referencia. Una empresa
que no nos conoce se lleva algo útil antes de que le pidamos nada, y descubre
de paso que su web no está preparada para lo que venimos a venderle. Esa es la
conversación que queremos tener.

```bash
npm run web:analizar -- tupanaderia.es        # el informe en la terminal
npm run web:analizar -- tupanaderia.es --json # el informe en crudo
npm run test:web                              # 170 comprobaciones, sin red
```

---

## Qué mide y qué no

**Qué mide.** El HTML que entrega el servidor y las cabeceras de la respuesta,
más cinco peticiones de apoyo: `robots.txt`, `sitemap.xml`, la primera hoja de
estilos propia, la versión sin cifrar del dominio y una sonda con parámetros de
campaña. Seis peticiones en total, unos dos segundos.

**Qué no mide.** No abre un navegador. No hay Core Web Vitals, ni LCP, ni
capturas: eso necesita Chrome y un presupuesto de tiempo que una función
serverless no tiene. Tampoco rastrea el sitio entero ni mira a la competencia.

Esa limitación está escrita en el informe, no escondida: *«medimos el HTML que
entrega tu servidor, no lo que acaba pintando un navegador; es una radiografía,
no una foto»*. Todo lo que el informe afirma lo puede comprobar cualquiera
mirando el código fuente de su propia web, y por eso **cada comprobación viene
con la prueba delante**.

---

## Las seis áreas

Los pesos suman 100 y están puestos pensando en una pyme que va a recibir
tráfico de una campaña, no en una auditoría SEO genérica.

| Área | Peso | Qué contesta |
|---|---|---|
| **Si convierte** | 22 | Si se te puede llamar, reservar, comprar o escribir, y si se ve un precio |
| **Confianza y ley** | 20 | El candado, el aviso legal, la privacidad y el consentimiento de cookies |
| **Cuánto tarda** | 18 | Lo que tarda tu servidor y lo que estorba antes de pintar nada |
| **En el móvil** | 15 | Donde entra el 90% del tráfico de un creador |
| **Lista para una campaña** | 13 | Vista previa al compartir, analítica, parámetros UTM y atribución |
| **Que te encuentren** | 12 | Si Google puede verte y qué entiende de ti |

«Si convierte» pesa más que nada porque todo lo demás sirve para que llegue
gente y solo esa decide si la gente hace algo. «Que te encuentren» pesa poco
porque el SEO es el canal más lento y el que menos tiene que ver con lo que
Mikro trae —pero la comprobación del `noindex` sola pesa lo que cinco, porque
es el fallo más caro y más invisible que existe.

### Lo que no mide nadie más

El área «Lista para una campaña» no sale en ningún analizador de webs, y es la
que justifica que esta herramienta exista dentro de Mikro. Cuatro cosas que
fallan en silencio:

1. **La vista previa al compartir.** Sin `og:image`, el creador pega tu enlace
   en una story y sale un rectángulo gris. Ese es el soporte por el que has
   pagado. Además comprobamos que la imagen declarada **se puede descargar**.
2. **Si mides algo.** Sin analítica, dentro de un mes la pregunta «¿valió la
   pena?» no tiene respuesta y la empresa decide por la sensación del día.
3. **Si sobreviven los parámetros de campaña.** Pedimos la página con
   `?utm_source=mikro&utm_medium=creador` y comprobamos que llegan al final.
   Muchas webs los pierden en una redirección: entonces todo el tráfico aparece
   como «directo» y la campaña parece no haber traído a nadie. Es el fallo más
   caro de todos porque no se nota —se nota al revés, concluyendo que los
   creadores no funcionan.
4. **Si se puede atribuir una venta.** Si detectamos Shopify, el informe dice
   que Mikro puede crear un código por creador y enseñar las ventas reales de
   cada uno (ver `docs/SHOPIFY.md`).

---

## Las tres reglas de la nota

1. **Lo que no se ha podido mirar no puntúa.** Ni a favor ni en contra: sale
   del denominador y se lista aparte con su motivo. Un analizador que te quita
   puntos por algo que no ha sabido medir está inventando una nota.
2. **Un aviso vale la mitad que un acierto.** No es lo mismo «mejorable» que
   «roto», ni no tener WhatsApp que no tener HTTPS.
3. **La nota global pondera las áreas, no las comprobaciones.** Si no, el área
   con más comprobaciones mandaría sobre las demás sin que nadie lo decidiera.

El orden de las prioridades **no** es el de la nota: es `peso dentro del área ×
peso del área`, es decir, los puntos de la nota global que recupera cada
arreglo. Por eso lo primero de la lista casi nunca sale del área peor puntuada,
que es exactamente el orden en el que le conviene gastar la tarde a quien lo
lee.

---

## Lo que aprendimos probando contra webs reales

Cuatro errores que la herramienta cometió contra webs que existen. Los cuatro
tienen su prueba de regresión en `backend/scripts/web-test.js`.

- **Un informe demoledor sobre una página que no era la web.** Una tienda
  devolvió un 200 de siete kilobytes: era un dominio aparcado en venta. Otra
  devolvió el muro de un antibots. Ahora se detectan los dos casos (más «en
  construcción» y la página de fábrica del servidor) y el informe **no lleva
  nota**: se dice qué había ahí y ya está (`web/muro.js`).
- **Un 429 confundido con un muro antibots.** Una tienda contestó «Too many
  requests» con `Retry-After: 60` y el informe la acusó de tener un sistema de
  protección, que es mandar a su dueño a buscar un problema que no tiene. Para
  decir «hay un antibots» ahora hace falta la huella del sistema o su frase;
  un código de error a secas es una web ocupada y se cuenta como tal. Si la
  espera que pide son tres segundos o menos, se espera y se reintenta una vez.
- **Un número de referencia confundido con un teléfono.** «Nueve cifras que
  empiezan por 6-9» daba por teléfono la referencia de un producto. Ahora hace
  falta prefijo, separadores o la palabra que lo anuncia.
- **La etiqueta «Calle y número» de un formulario tomada por la dirección del
  negocio.** Ahora se exige número de portal.
- **«Elige tu horario» tomado por el horario de apertura.** Ahora hacen falta
  días u horas de verdad.

Y de ese 429 salió lo mejor de todo el módulo. Esa tienda dejaba pasar a
Chrome y rechazaba a quien se identificara como robot, así que en lugar de
quedarse en «no hemos podido verla» se le vuelve a preguntar con la cara de
los robots que dibujan la vista previa de un enlace compartido. Resultado:
`facebookexternalhit` —el de **Instagram y Facebook**— se comía el mismo
rechazo, mientras WhatsApp pasaba. Para una tienda que va a trabajar con
creadores eso no es un detalle técnico: es que el enlace que publique el
creador puede salir en gris, sin imagen y sin nada en lo que pulsar. Son dos
peticiones de más en el único caso en el que, si no, no tendríamos nada que
contar.

Pero **una observación no es un veredicto**. El mismo robot recibió un 429 en
un intento y un 200 dos minutos después, así que el aviso dice «en este
intento», no sube el semáforo a rojo y manda a comprobarlo en el depurador de
enlaces de Meta, que es donde se comprueba de verdad.

Y una decisión que no es un error: una web montada con
JavaScript llega prácticamente vacía. Lo honrado no es suspenderla, es decir
que no se ha podido mirar. El informe lo detecta, lo avisa lo primero y marca
esas comprobaciones como no comprobadas.

---

## Las piezas

```
backend/src/web/
  seguridad.js      a dónde se puede ir y a dónde no (SSRF)
  traer.js          descargar con límites de tiempo, peso y saltos
  html.js           leer HTML sin dependencias
  huellas.js        reconocer plataformas, analítica, píxeles y consentimiento
  muro.js           cuando lo que contestan no es la web
  recoger.js        la única parte con red; produce la radiografía
  comprobacion.js   la forma de una comprobación
  areas/*.js        las 46 comprobaciones, puras, una área por fichero
  puntuar.js        notas, pesos y prioridades
  informe.js        qué se cuenta primero, y el informe en texto plano
backend/src/routes/web.js    la ruta pública, con freno y caché
frontend/src/pages/WebCheck.jsx    /analisis-web
```

**La decisión que sostiene todo lo demás** está en `recoger.js`: separa la
descarga del análisis. `recoger()` sale a la red y produce una radiografía;
`leer()` es pura y la construye a partir de un HTML. Por eso las 46
comprobaciones se prueban con HTML escrito a mano, en medio segundo y sin
depender de que la web de nadie siga viva. Una suite que necesitara webs reales
fallaría los martes porque a alguien se le caducó un certificado, y entonces
dejaríamos de ejecutarla.

---

## El API

| Ruta | Para qué |
|---|---|
| `POST /api/web/analisis` `{url}` | El informe. Público |
| `GET /api/web/analisis?url=` | El mismo, enlazable y cacheable en el CDN |
| `GET /api/web/analisis.txt?url=` | En texto plano, para pegarlo en un correo |
| `GET /api/web/analisis/mia` | La web que la empresa puso en su perfil |

**Freno:** seis análisis cada diez minutos por IP (`lib/ritmo.js`). Da de sobra
para probar la propia web, corregir algo y volver a mirar; no da para
recorrerse una lista de dominios con nuestra IP y nuestra factura.

**Caché:** media hora por URL normalizada. «Tienda.es», «tienda.es/» y
«https://tienda.es» son el mismo análisis y no deben costar tres.

**SSRF:** es un formulario público que hace peticiones desde dentro de nuestra
infraestructura. Se valida la forma de la URL (solo http/https, puertos 80 y
443, sin `usuario:clave@`) **y el destino real**: se resuelve el DNS y se exige
que todas las IPs sean públicas —un dominio público puede apuntar a 127.0.0.1,
y ese es el truco. La comprobación se repite en cada redirección, porque una web
puede contestar 302 hacia `http://169.254.169.254/`, que es donde viven las
credenciales de la nube.

---

## Lo siguiente, si se retoma

- **Guardar los informes.** Hoy es sin estado. Una tabla con dominio, nota y
  fecha convertiría esto en una lista de pymes a las que llamar, y permitiría
  enseñar «tu web ha mejorado 12 puntos desde marzo».
- **Más de una página.** Ahora se mira solo la que te dan. Una ficha de
  producto puede estar mucho peor que la portada.
- **Medida de navegador.** Un servicio aparte con Chrome sin cabeza daría los
  Core Web Vitals reales. Es otra herramienta, no una ampliación de esta.
