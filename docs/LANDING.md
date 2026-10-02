# Landing de Mikro — diseño

> Documento de diseño previo a la implementación. Describe la idea, la mecánica de
> las transiciones, el contenido y las decisiones técnicas, para poder discutirlo
> antes de escribir código.

---

## 1. La idea

Las tres secciones **no son tres pantallas distintas**: son tres estados de una misma
pieza. Un grupo de tarjetas de creadores entra en escena girando, colapsa en un
ranking y después se da la vuelta para enseñar su reverso.

| Sección | Estado de la pieza | Qué cuenta | A quién habla |
|---|---|---|---|
| 1. Órbita | Las tarjetas giran en círculo | "Esto está vivo, hay gente aquí" | A los dos |
| 2. Podio | La órbita colapsa en un ranking | "Aquí se mide quién mueve de verdad" | Al creador |
| 3. Reverso | El panel gira y muestra su espalda | "Y esto es lo que gana tu marca" | A la empresa |

Es, literalmente, el recorrido del producto: **descubres → comparas → contratas**. La
originalidad no está en el efecto, sino en que el efecto *significa* algo: la misma
materia se reordena según quién la mire.

**Lema:** *Marcas que conectan. Creadores que inspiran.*
Recupera la frase de la referencia original del proyecto y tiene la ventaja de nombrar
a los dos públicos en una sola línea, que es exactamente el problema de esta landing.

---

## 2. Lenguaje visual

Hereda el de la aplicación y lo sube de intensidad, porque una landing puede permitirse
lo que un panel de trabajo no.

- **Fondo:** `#0b0d12` (el `ink` de la app) con una aurora de tres radiales a baja
  opacidad: azul de marca `#2563eb`, violeta `#8b5cf6` y cian `#22d3ee`. Se mueven muy
  despacio (40 s) para que el fondo nunca esté del todo quieto.
- **Rejilla:** la misma trama de 56 px que ya usa el hero de Descubrir, al 6% de
  opacidad. Es el hilo que une la landing con el interior.
- **Tipografía:** Inter. Titulares en 900 con `tracking -0.045em`; el nombre de la
  plataforma en un tamaño fluido `clamp(72px, 11vw, 168px)`.
- **Tarjetas:** 240 × 340, radio 24, borde de 1 px al 10% de blanco, y un degradado
  propio por categoría. Encima, la pieza real del portfolio del creador.
- **Acento:** el azul de marca manda en botones y datos; violeta y cian son solo luz.

La diferencia de temperatura respecto a las referencias es deliberada: ellas son
violeta-cian puro, nosotros mantenemos el azul de Mikro como color de acción para que
la landing y la aplicación se reconozcan como lo mismo.

---

## 3. Sección 1 — Órbita

```
┌──────────────────────────────────────────────────────────┐
│  mikro ↗                        [Iniciar sesión] [Regístrate] │
│                                                          │
│                        m i k r o                         │  ← nombre, 168px
│          Marcas que conectan. Creadores que inspiran.    │  ← lema, 22px
│                                                          │
│            ╭─────╮   ╭───────────╮   ╭─────╮             │
│       ╭───╮│ ... │   │  TARJETA  │   │ ... │╭───╮        │  ← órbita 3D
│       │   ││     │   │  CENTRAL  │   │     ││   │        │
│       ╰───╯╰─────╯   ╰───────────╯   ╰─────╯╰───╯        │
│                                                          │
│              [ Soy creador ]  [ Soy empresa ]            │  ← CTA doble
│                         ↓ scroll                         │
└──────────────────────────────────────────────────────────┘
```

**El carrusel.** Doce tarjetas repartidas en un cilindro: cada una en
`rotateY(θ) translateZ(420px)`, con `perspective: 1400px` en el contenedor. La que
queda de frente se escala a 1 y las demás pierden escala y opacidad según se alejan,
de modo que la atención siempre está en el centro sin necesidad de oscurecer nada.

Gira sola, una vuelta cada 60 segundos: lo bastante lento para que no distraiga de los
CTA, lo bastante vivo para que se note que no es una imagen. Se pausa cuando la sección
sale de pantalla y al pasar el ratón por encima.

**Contenido de la tarjeta:** chip de categoría arriba a la izquierda; a la derecha,
`EN DIRECTO` (con punto latiendo) o la antigüedad de la publicación; abajo, una barra
con avatar, nombre, distintivo de verificado, número de seguidores y dos botones
circulares: me gusta y enviar.

**Los botones de la tarjeta llevan a registro.** Sin sesión no se puede dar un me gusta
de verdad, y fingirlo sería mentir: al pulsarlos se abre `/registro`. Son el anzuelo
más natural de la página.

**Datos reales.** Las tarjetas se alimentan de `/api/rankings?limit=12`: creadores,
seguidores y piezas de portfolio de verdad. Si el API tarda o falla, hay doce tarjetas
de respaldo con los mismos degradados, para que la primera impresión no dependa de la
red.

---

## 4. Transición 1 → 2: la absorción

El tramo más delicado. La órbita no desaparece: **se recoge**.

```
  órbita (p=0,28)        recogida (p=0,40)        podio (p=0,50)

   ╭─╮ ╭─╮ ╭─╮              ╭╮ ╭╮ ╭╮                    ╭─╮
  ╭─╮     ╭─╮      →         ╰╮╰╮╭╯╭╯        →      ╭─╮ │1│ ╭─╮
   ╰─╯ ╰─╯ ╰─╯                 ╰╯╰╯                  │2│ ╰─╯ │3│
                                                     ────────────
                                                      04 ──────
                                                      05 ──────
```

**Cómo funciona.** La escena es un bloque de `320vh` con una capa `sticky` que ocupa la
pantalla. Un hook calcula el progreso `p ∈ [0,1]` del scroll dentro de ese bloque y, en
cada fotograma, cada tarjeta recibe un `transform` que es la **mezcla** de dos estados:

- **Estado órbita:** su posición en el cilindro (ángulo, radio, escala).
- **Estado destino:** su hueco en el podio o en la lista, en píxeles.

No se interpola entre dos sistemas de coordenadas distintos —eso daría tirones—, sino
que ambos estados se resuelven a `x, y, z, rotateY, scale, opacity` y se interpolan
número a número con una curva suave. El radio del cilindro se encoge hacia cero a la
vez, que es lo que produce la sensación de absorción.

**Reparto:** las tres primeras tarjetas aterrizan en el podio; las siete siguientes se
convierten en las filas de la lista; las dos sobrantes se encogen hacia el centro y se
desvanecen, como si el ranking se las hubiera tragado.

**Tramos de scroll:**

| p | Qué ocurre |
|---|---|
| 0,00 – 0,28 | Hero quieto. La órbita gira en su bucle. |
| 0,28 – 0,50 | Absorción. El título y los CTA del hero se desvanecen y suben. |
| 0,50 – 0,70 | Ranking montado y quieto. Entran el titular y el CTA de creador. |
| 0,70 – 0,92 | Giro del panel. |
| 0,92 – 1,00 | Cara de empresas quieta. |

Durante la absorción, las tarjetas pierden el degradado de portada y ganan el fondo
sólido de las filas: el cambio se hace con un `opacity` cruzado entre dos capas dentro
de la misma tarjeta, no cambiando el nodo, para que no haya parpadeo.

---

## 5. Sección 2 — Podio

Toma la idea de la referencia y la traduce a nuestro vocabulario: aquí no hay "puntos
de jugador", hay **puntuación de Mikro**, la misma que ordena el ranking de la app
(engagement 34%, alcance 20% logarítmico, reputación, actividad).

```
                    ♛
                  ╭───╮
        ╭───╮     │ AR│     ╭───╮
        │ LM│     ╰───╯     │ DV│
        ╰───╯   Marta G.    ╰───╯
       Alex N.              Lucía S.
      ┌─────┐  ┌───────┐  ┌─────┐
      │  2  │  │   1   │  │  3  │
      │ 73  │  │  78   │  │ 70  │
      │▲3,2%│  │ ▲5,8% │  │▲1,4%│
      └─────┘  └───────┘  └─────┘
  ┌──────────────────────────────────────┐
  │ 04  ◯ CarlosPlay   ████████░░  67 ▲2 │
  │ 05  ◯ Laura J.     ███████░░░  64 ▼1 │
  │ ...                                  │
  └──────────────────────────────────────┘

            [ Soy creador ]
```

- Avatares circulares con anillo de color (oro, plata, bronce) y corona sobre el primero.
- Bloques del podio con el número en degradado metálico, la puntuación y la variación
  semanal. El del centro es más alto y tiene un halo cálido, como en la referencia.
- Lista del 4 al 10 con barra de progreso proporcional a la puntuación, avatar, nombre,
  `@usuario`, puntos y variación.
- **Un detalle que la referencia tiene y conviene robar:** la fila del usuario actual
  resaltada. Aquí, como no hay sesión, la última fila se sustituye por una invitación:
  *"07 · Tu nombre aquí — crea tu perfil y entra en el ranking"*, con el mismo formato
  que las demás. Convierte una lista en un espejo.

**Titular de la sección:** *Aquí se mide quién mueve de verdad.*
**Apoyo:** *No ordenamos por seguidores. Un perfil de 20K con comunidad viva está por
delante de uno de 500K con audiencia fría.*
**CTA:** `Soy creador` → `/registro?rol=creador`.

---

## 6. Transición 2 → 3: el giro

El panel que contiene el ranking rota sobre su eje vertical: `rotateY` de 0° a 180°,
con `transform-style: preserve-3d` y una cara trasera en `rotateY(180deg)`.

```
     p = 0,70            p = 0,81            p = 0,92
    ┌────────┐             ╱│╲              ┌────────┐
    │ PODIO  │     →      ╱ │ ╲      →      │EMPRESAS│
    └────────┘           ╱  │  ╲            └────────┘
      frente              de canto            reverso
```

Tres detalles para que no parezca un truco de PowerPoint:

1. **La perspectiva se exagera a mitad de giro** (de 1400 px a 1100 px) y el panel se
   aleja un poco en Z: da peso, como si fuera un objeto físico.
2. **Las sombras acompañan.** Una sombra proyectada bajo el panel se estrecha y se
   oscurece al ponerse de canto, y vuelve a abrirse al completarse.
3. **El contenido de la cara trasera entra escalonado** una vez pasado el ecuador
   (p > 0,82), no de golpe con el panel: primero el titular, luego los beneficios de
   dos en dos.

La cara frontal lleva `backface-visibility: hidden`, así que el ranking desaparece solo
al cruzar el ecuador, sin fundidos artificiales.

---

## 7. Sección 3 — El reverso: empresas

El reverso de un ranking es, literalmente, lo que hay detrás de esos números: lo que
una marca compra cuando contrata a esa gente.

**Titular:** *Al otro lado del ranking está tu campaña.*

Cuatro beneficios en rejilla 2 × 2, cada uno con un icono, tres palabras de titular y
una línea de apoyo. Breves de verdad:

| | |
|---|---|
| **Desde 60 €** · Una colaboración cuesta menos que dos días de anuncios. | **Engagement real** · Comunidades pequeñas y fieles, no audiencias infladas. |
| **Pago en garantía** · El dinero no se mueve hasta que apruebas el contenido. | **El contenido es tuyo** · Reutilízalo en tus redes, tu web y tus anuncios. |

Debajo, una línea de cifras vivas tomadas de `/api/stats/home` (creadores, alcance
sumado, engagement medio) y el CTA `Soy empresa` → `/registro?rol=empresa`.

Al terminar el giro, la página continúa con un pie sobrio: enlaces legales, contacto y
el acceso a `Recursos`. La escena 3D acaba ahí; nada de efectos en el pie.

---

## 8. Qué pasa con el resto de la aplicación

La petición es que **el interior sea solo para usuarios**. Eso cambia el enrutado:

| Ruta | Antes | Después |
|---|---|---|
| `/` | Descubrir | **Landing** si no hay sesión; si la hay, redirige al panel según rol |
| `/descubrir` | — | Descubrir, protegido |
| `/rankings`, `/creador/:handle` | públicas | protegidas |
| `/para-empresas`, `/para-creadores` | públicas | se funden en la landing y desaparecen |
| `/recursos` | pública | **sigue pública** (guías, tarifas y obligaciones legales; no es "interior") |
| `/entrar`, `/registro` | públicas | públicas |

> **Una objeción que dejo por escrito, y luego hago lo que decidas.** El ranking público
> era el principal imán de captación de creadores: un creador que se ve listado quiere
> mejorar su posición, y para eso se registra. Cerrarlo nos deja sin esa puerta de
> entrada y sin nada que indexe Google salvo la landing. Una fórmula intermedia sería
> dejar `/rankings` visible con los diez primeros y el resto difuminado tras el
> registro. Si prefieres cerrarlo del todo, se cierra.

---

## 9. Responsive y accesibilidad

**No todo el mundo debe tragarse la escena.** La animación de scroll es cara y, en
pantallas pequeñas, molesta.

| Contexto | Qué se sirve |
|---|---|
| ≥ 1280 px | Escena completa: órbita, absorción y giro. |
| 768 – 1279 px | Igual, con radio de órbita de 300 px y podio compacto. |
| < 768 px | **Sin escena 3D.** Tres secciones apiladas: carrusel horizontal con `scroll-snap`, ranking estático y bloque de empresas. Misma información, sin secuestro del scroll. |
| `prefers-reduced-motion` | Lo mismo que en móvil, en cualquier tamaño. No es una degradación: es la versión correcta para quien la pide. |

Además:

- Los enlaces dentro de las tarjetas siguen siendo accesibles con teclado; al recibir
  foco, la órbita se detiene y lleva esa tarjeta al frente.
- Los botones de me gusta y enviar llevan `aria-label` explícito ("Guardar a Marta
  García — requiere cuenta").
- Contraste mínimo 4,5:1 en todo el texto sobre el fondo oscuro.
- La página funciona con JavaScript lento: el contenido existe en el DOM desde el
  primer render; la animación solo lo coloca.

---

## 10. Implementación prevista

```
frontend/src/pages/Landing.jsx           orquesta la escena y el progreso de scroll
frontend/src/components/landing/
  Orbit.jsx          carrusel circular y tarjetas
  Podium.jsx         podio y lista del ranking
  BrandsFace.jsx     cara trasera del panel
  CreatorCard3D.jsx  la tarjeta, con sus dos caras (portada / fila)
  useScrollScene.js  progreso de scroll, tramos y preferencias de movimiento
  layout.js          posiciones de órbita y de ranking, y la mezcla entre ambas
```

- **Sin librerías de animación.** `requestAnimationFrame` + `transform`/`opacity`, que
  es lo único que el compositor puede animar sin repintar. Añadir GSAP o Framer Motion
  para esto serían 40 KB a cambio de nada.
- Las posiciones de destino se miden con `getBoundingClientRect` sobre un esqueleto de
  ranking invisible, de modo que el layout real manda y no hay números mágicos.
- `IntersectionObserver` para no animar lo que no se ve.
- La escena se recalcula en `resize` con *debounce*.

**Riesgo principal:** el *jank* en la absorción si se animan sombras o filtros. Mitigación:
durante los tramos de movimiento, las tarjetas pierden `box-shadow` y `backdrop-filter`,
que se restituyen al quedarse quietas. Es invisible y es la diferencia entre 60 fps y 30.

---

## 11. Lo que hay que decidir

1. **¿Se cierra el ranking público?** Mi recomendación está en el apartado 8.
2. **El lema.** Propongo *"Marcas que conectan. Creadores que inspiran."* Si prefieres
   algo más directo al negocio: *"Publicidad que se nota, a precio de pyme."*
3. **La última fila del ranking como invitación** ("Tu nombre aquí"). Me parece el mejor
   detalle de la sección, pero es una licencia: el resto de filas son datos reales.
