# Mikro — Estrategia de negocio

> Marketplace que conecta pymes españolas con micro-influencers.
> Documento de trabajo. Las cifras de mercado son estimaciones de orden de magnitud,
> no datos auditados: antes de levantar capital habría que contrastarlas con INE,
> Infoadex y un panel propio de entrevistas.

---

## 1. El problema

**Del lado de la pyme.** Una panadería de Valencia, un gimnasio de barrio o una tienda
de decoración tienen presupuesto para publicidad —entre 300 y 2.000 € al mes— pero no
tienen ni equipo de marketing ni acceso a agencias, cuyo mínimo de entrada ronda los
1.500 € mensuales más fee. Sus opciones hoy son:

1. **Anuncios en Meta/Google.** Baratos de empezar, caros de dominar. Sin alguien que
   los optimice, el coste por resultado se dispara y la pyme concluye que "la
   publicidad online no funciona".
2. **Buscar influencers a mano.** Significa rastrear Instagram, escribir por DM, no
   recibir respuesta, negociar a ciegas sin saber si 300 € es caro o barato, y asumir
   el riesgo de pagar por adelantado a un desconocido.
3. **No hacer nada.** Es la opción mayoritaria.

**Del lado del creador.** Hay decenas de miles de perfiles españoles entre 5.000 y
50.000 seguidores con comunidades locales y muy comprometidas. Son demasiado pequeños
para interesar a las agencias, que trabajan con macro-influencers, y demasiado grandes
para conformarse con que les regalen producto. No saben qué precio pedir, no tienen
forma de demostrar su valor más allá de una captura de pantalla de sus estadísticas, y
cuando cierran un acuerdo cobran tarde o no cobran.

**El hueco.** Entre la pyme que no sabe a quién contratar y el creador que no sabe cómo
venderse no hay infraestructura. Mikro es esa infraestructura.

---

## 2. Propuesta de valor

> **Publicidad que se nota, a precio de pyme.**

| | Qué resuelve Mikro |
|---|---|
| **Para la pyme** | Catálogo de creadores filtrable por nicho, ciudad, tamaño y engagement real. Afinidad calculada con su brief. Precio transparente desde 60 €. El dinero queda retenido hasta que aprueba el contenido. |
| **Para el creador** | Marcas locales que buscan justo lo que él hace. Tarifas de referencia para no malvenderse. Cobro garantizado: el importe se deposita antes de grabar. Reputación acumulada y pública. |

### Por qué micro y no macro

El posicionamiento no es un capricho de nicho, es la tesis del producto:

- El engagement cae según crece la cuenta. Un perfil de 20K con un 6% mueve más gente
  real que uno de 500K con un 1,2%.
- El micro-influencer es **local**. Para un negocio con un punto de venta físico, eso
  importa más que el alcance total.
- El precio de entrada (60–400 €) cabe en el presupuesto de una pyme; el de un macro
  (5.000 € o más) no.
- La oferta de micro-influencers está infraatendida: nadie compite por ellos, así que
  captarlos es barato.

Esto se traduce en el algoritmo de ranking (`backend/src/services/scoring.js`), donde
el engagement pesa un 34% y el alcance solo un 20%, además en escala logarítmica.

---

## 3. Segmentos

**Cliente objetivo inicial (pyme):**
- 5 a 50 empleados, con punto de venta físico o marca de producto.
- Sectores de arranque: hostelería, alimentación, belleza, fitness, moda, decoración,
  mascotas y turismo local.
- Ciudades: Madrid, Barcelona, Valencia, Sevilla, Bilbao y Málaga en la primera fase.
- Presupuesto de marketing entre 300 y 2.000 €/mes.
- Perfil de comprador: dueño o responsable de marketing que ya publica en redes.

**Oferta objetivo (creador):**
- 5.000 a 100.000 seguidores, engagement por encima del 3%.
- Audiencia mayoritariamente española y concentrada en una ciudad o región.
- Que ya haya hecho alguna colaboración, aunque fuera a cambio de producto.

---

## 4. Modelo de ingresos

### 4.1 Comisión por transacción (motor principal)

**12% sobre cada colaboración cerrada**, descontado del importe que cobra el creador.
La empresa paga exactamente lo acordado; el creador recibe el 88%.

Se cobra al creador y no a la empresa por dos razones: reduce la fricción en el lado
escaso (la demanda) y hace que el precio anunciado sea el precio final, que es el
argumento comercial más fuerte frente a una agencia.

Está implementado en `PLATFORM_FEE_PCT` y se aplica al aceptar la candidatura, de modo
que ambas partes ven el neto antes de comprometerse.

### 4.2 Suscripciones (margen y retención)

| Plan | Precio | Para quién | Qué incluye |
|---|---|---|---|
| **Gratis** | 0 € | Toda pyme | Campañas ilimitadas, búsqueda, pagos en garantía. Comisión 12%. |
| **Pro** | 39 €/mes | Pyme que contrata cada mes | Comisión reducida al 8%, búsqueda con IA ilimitada, informes por campaña, invitaciones masivas. |
| **Agencia** | desde 149 €/mes | Agencias locales y grupos | Varias marcas en una cuenta, comisión 6%, gestor dedicado, facturación agrupada. |
| **Creator+** | 9 €/mes | Creador profesionalizado | Estadísticas de visitas a su perfil, candidaturas ilimitadas, distintivo de perfil. |

La lógica del plan Pro: a partir de ~4 colaboraciones al mes, la rebaja del 12% al 8%
compensa la cuota. El cliente que más factura es el que más incentivo tiene para
suscribirse, y al suscribirse aumenta su frecuencia de uso.

### 4.3 Ingresos secundarios (fase 2)

- **Posiciones destacadas** en el ranking y en las categorías: 49 €/semana para el
  creador que quiera visibilidad (ya existe el campo `featured`).
- **Campañas patrocinadas** de marcas medianas que quieran aparecer arriba en el muro
  de oportunidades.
- **Servicios de producción**: brief redactado por Mikro, selección curada de cinco
  perfiles y seguimiento, por 149 € por campaña. Es el puente hacia las pymes que no
  quieren elegir ellas mismas.
- **Datos agregados y anónimos** de tarifas y engagement por sector y ciudad, vendidos
  como informe de mercado.

---

## 5. Economía unitaria

Cifras de trabajo para el escenario base. Sirven para saber qué hay que validar, no
como promesa.

**Por colaboración**
| Concepto | Valor |
|---|---|
| Importe medio de la colaboración | 250 € |
| Comisión Mikro (12%) | 30 € |
| Coste variable (pasarela ~1,4% + soporte) | ~7 € |
| **Margen de contribución** | **~23 €** |

**Por cliente (pyme)**
| Concepto | Valor |
|---|---|
| Colaboraciones al año | 6 |
| Margen bruto anual | ~138 € |
| Vida media estimada | 2,5 años |
| **LTV** | **~345 €** |
| CAC objetivo (contenido + SEO local + ads) | 45 € |
| **LTV / CAC** | **~7,6x** |
| Meses hasta recuperar el CAC | ~4 |

**Palancas de crecimiento del LTV**, por orden de impacto esperado:
1. Aumentar la frecuencia (de 6 a 10 colaboraciones/año) con recordatorios estacionales
   y campañas recurrentes.
2. Convertir al plan Pro (añade 468 €/año de ingreso recurrente por cliente).
3. Subir el ticket medio ofreciendo packs de varios creadores en la misma campaña.

**Punto de equilibrio aproximado.** Con una estructura mínima (dos personas, ~8.000 €
al mes de costes), harían falta unas 350 colaboraciones mensuales, o bien una mezcla de
~200 colaboraciones y 60 suscripciones Pro. Es el objetivo del mes 18.

---

## 6. Mercado

- En España hay del orden de **2,9 millones de empresas**, de las que más del 99% son
  pymes. La mayoría no son direccionables: sin actividad digital o sin presupuesto.
- **Mercado direccionable estimado:** ~300.000 pymes con presencia activa en redes y
  gasto publicitario recurrente.
- **Mercado alcanzable a 5 años (SAM):** ~30.000 empresas en las diez principales áreas
  metropolitanas, en los ocho sectores de arranque.
- **Objetivo realista a 3 años (SOM):** 4.000 empresas activas y 12.000 creadores.
  A 6 colaboraciones/año y 250 € de ticket, eso son ~6 M€ de volumen transaccionado y
  ~720.000 € de comisión, más el recurrente de las suscripciones.

El viento de cola es claro: el gasto en marketing de influencia crece a doble dígito
anual y el peso del segmento micro crece dentro de él, porque las marcas buscan
rentabilidad por euro invertido, no vanidad.

---

## 7. Competencia y posicionamiento

| Competidor | Qué hace | Por qué no cubre este hueco |
|---|---|---|
| Agencias de influencers | Campañas llave en mano para marcas grandes | Mínimos de 1.500–5.000 €. Inalcanzable para una pyme. |
| Plataformas globales (Heepsy, Upfluence, Influencity) | Bases de datos enormes con filtros | Herramientas de búsqueda, no marketplaces: no hay contratación, ni pago en garantía, ni cierre. Suscripción cara y en inglés. |
| Marketplaces de UGC | Contenido para anuncios | El creador no publica en su perfil; se pierde la prescripción y la comunidad. |
| Contacto directo por Instagram | Gratis | Sin catálogo, sin precios de referencia, sin garantía de pago, sin reputación. Es el competidor real. |

**Posicionamiento de Mikro:** el único sitio donde una pyme española cierra y paga una
colaboración con un micro-influencer local de principio a fin, sin agencia y con el
dinero protegido.

Las tres defensas a largo plazo:
1. **Efecto de red local.** Cuanta más oferta hay en una ciudad, mejor es la
   experiencia de la pyme de esa ciudad, lo que atrae más pymes, que atraen más
   creadores. La estrategia de lanzamiento es ciudad a ciudad justamente por esto.
2. **Datos propietarios.** Tarifas reales pagadas, tasas de aceptación y valoraciones.
   Con volumen, Mikro sabrá recomendar mejor que nadie qué perfil funciona para qué
   sector, y podrá publicar el índice de precios de referencia del mercado español.
3. **Reputación portátil.** El historial del creador vive en Mikro; cambiar de
   plataforma implica empezar de cero.

---

## 8. Salida al mercado

**Fase 1 — Una ciudad, meses 1 a 4.** Valencia, por tamaño manejable y tejido de
hostelería y comercio local denso.
- Captar 300 creadores a mano, uno a uno por DM, empezando por gastronomía, fitness y
  moda. Es trabajo no escalable y hay que hacerlo.
- Traer 40 pymes con visitas comerciales y un incentivo claro: primera campaña con
  comisión cero.
- Objetivo: 100 colaboraciones cerradas y diez casos de éxito documentados con números.

**Fase 2 — Replicar, meses 5 a 12.** Madrid, Barcelona y Sevilla, con el mismo manual y
la ventaja de tener ya casos que enseñar.
- Contenido SEO local: "influencers de gastronomía en Barcelona", "cuánto cobra un
  micro-influencer en España". Alta intención de búsqueda y competencia baja.
- Alianzas con asociaciones de comerciantes, cámaras de comercio y gestorías.
- Programa de recomendación: 50 € de saldo para quien traiga una pyme que cierre.

**Fase 3 — Escala, meses 13 a 24.** Resto de España.
- Captación de creadores en automático: el ranking público es el imán. Un creador que
  se ve listado quiere mejorar su posición, y para eso completa su perfil e invita a
  las marcas con las que ya trabaja.
- Empujar el plan Pro sobre la base de clientes recurrentes.

**El arranque del problema del huevo y la gallina** se resuelve por el lado de la
oferta: los creadores entran gratis, en minutos y con el aliciente del ranking público,
mientras que la demanda necesita ver catálogo el primer día. Por eso el producto se
lanza con el ranking y el buscador abiertos sin registro.

---

## 9. Métricas

**La métrica que manda:** colaboraciones cerradas y pagadas por semana. Es lo único
que significa a la vez que la pyme encontró a alguien, que el creador aceptó, que el
contenido se entregó y que el dinero se movió.

**Salud del marketplace**
- Tasa de conversión de campaña publicada a colaboración cerrada (objetivo: >60%).
- Tiempo desde la publicación hasta la primera candidatura (objetivo: <24 h).
- Candidaturas por campaña (objetivo: 5–12; por debajo hay poca oferta, por encima se
  frustra a los creadores que no son elegidos).
- Porcentaje de creadores con al menos una colaboración en 90 días (liquidez de la
  oferta, objetivo: >35%).

**Negocio**
- GMV, ingreso por comisión y MRR de suscripciones.
- Repetición: pymes con dos o más campañas en 6 meses (objetivo: >45%).
- CAC por canal y meses hasta recuperarlo.

**Calidad**
- Valoración media de las colaboraciones (objetivo: >4,3/5).
- Tasa de cancelación y de disputa (objetivo: <5%).

---

## 10. Riesgos

| Riesgo | Impacto | Cómo se mitiga |
|---|---|---|
| **Desintermediación**: se conocen en Mikro y repiten por fuera | Alto | Que quedarse compense: pago garantizado, historial y reputación, facturación resuelta, descuento por volumen. Nunca perseguirlo con cláusulas que no se pueden hacer cumplir. |
| **Métricas infladas o seguidores comprados** | Alto | Verificación por conexión con la API de la red, penalización de crecimientos anómalos en el ranking y valoraciones públicas de las marcas. |
| **Liquidez insuficiente en una ciudad** | Alto | Lanzar ciudad a ciudad y no abrir la siguiente hasta tener densidad en la anterior. |
| **Impagos y disputas** | Medio | Depósito en garantía obligatorio antes de producir y proceso de mediación con plazos. |
| **Cambios en las APIs de las redes** | Medio | Métricas declaradas por el creador y verificadas por muestreo, no dependientes de una sola API. |
| **Entrada de un gran actor** (Meta, TikTok o una plataforma global) | Medio | La ventaja es local y de servicio, no tecnológica: conocer el tejido de cada ciudad y hablar el idioma de la pyme. |
| **Regulación de publicidad encubierta** | Bajo | Recordatorio de etiquetado en cada colaboración y contenidos formativos; es una ventaja frente al contacto por DM. |

---

## 11. Hoja de ruta de producto

**Implementado en este MVP**
- Catálogo, ranking y búsqueda con filtros.
- Búsqueda en lenguaje natural con interpretación visible.
- Perfiles de creador con métricas, portfolio, tarifas y valoraciones.
- Campañas, candidaturas e invitaciones directas.
- Ciclo completo de colaboración con depósito en garantía, entrega, aprobación y pago.
- Mensajería por colaboración, valoraciones y notificaciones.
- Paneles de empresa y de creador, y backoffice de verificación.

**Siguiente (3 meses)**
- Pasarela de pago real (Stripe Connect con cuentas de creador).
- Verificación por OAuth con Instagram, TikTok y YouTube.
- Facturación automática y justificantes descargables.
- Informe de resultados por campaña con las métricas del contenido publicado.

**Después (6–12 meses)**
- Packs de varios creadores en una sola campaña, con pago único.
- Recomendador entrenado con los cierres reales de la plataforma.
- Aplicación móvil para creadores (es donde viven).
- Índice público de tarifas por sector y ciudad, como pieza de captación.
