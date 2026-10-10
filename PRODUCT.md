# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Creadores (público prioritario de la home, confirmado):** micro-influencers españoles de 5.000 a 50.000 seguidores con comunidades locales y comprometidas. Demasiado pequeños para las agencias, demasiado grandes para trabajar a cambio de producto. No saben qué precio pedir, no tienen forma de demostrar su valor más allá de una captura de estadísticas y cobran tarde o no cobran. El marketplace necesita oferta de creadores antes que demanda.
- **Pymes (segundo público, quien paga):** 5 a 50 empleados, con punto de venta físico o marca de producto (hostelería, alimentación, belleza, fitness, moda, decoración, mascotas, turismo local), presupuesto de marketing de 300 a 2.000 € al mes, sin equipo de marketing ni acceso a agencias. Decide el dueño o un responsable sin perfil técnico.
- **Admin:** backoffice interno de verificación y métricas.

## Product Purpose

Marketplace que conecta pymes españolas con micro-influencers de su ciudad y su nicho. La pyme publica una campaña, recibe candidaturas, acuerda el precio y paga con el dinero retenido hasta aprobar el contenido. Sin agencias. Éxito: que creadores y pymes cierren colaboraciones pagadas sin intermediarios.

## Positioning

Infraestructura para el hueco entre la pyme que no sabe a quién contratar y el creador que no sabe cómo venderse. Lo que la distingue:
- Foco en micro y local: el ranking pondera el engagement (34%) por encima del alcance (20%, escala logarítmica). Ver `backend/src/services/scoring.js`.
- Pago en garantía: el importe se deposita antes de grabar y se libera al aprobar el contenido.
- Tarifas de referencia y precio transparente (colaboraciones desde 60 €).
- Reputación pública y acumulada del creador (ranking y valoraciones).

## Operating Context

Catálogo y ranking públicos, búsqueda en lenguaje natural, campañas, candidaturas, ciclo de colaboración con pago retenido, mensajería, valoraciones y backoffice. Petición de demo para pymes sin necesidad de cuenta. Ciudades de arranque: Madrid, Barcelona, Valencia, Sevilla, Bilbao y Málaga.

## Capabilities and Constraints

- Stack existente: React 18 + Vite + Tailwind 3, React Router, Express + Prisma, desplegado en Netlify con Postgres (Supabase). Iconos: lucide-react.
- Comisión única del 12%. Publicar campañas es gratis, sin cuota ni permanencia.
- Fase: demo / MVP sin clientes reales.
- Planificado (decidido por el usuario, sin empezar): una app de Shopify para que las tiendas creen sus campañas de Mikro desde Shopify, se midan las ventas reales que genera cada campaña y se gestione todo vinculado con Shopify.
- Pendiente: los creadores destacados de los datos de demostración (`backend/prisma/seed.js`) son cuentas de cientos de miles o millones de seguidores, lo que contradice el posicionamiento micro.

## Brand Commitments

- Nombre y wordmark: `mikro` en minúsculas con la flecha ↗ (componente `Logo` en `frontend/src/components/ui.jsx`). Intocable.
- Fondo oscuro (tinta `#0b0d12`) y azul de marca (`brand-600 #2563eb`). Intocables.
- Idioma: español de España, tuteo.

## Evidence on Hand

- Ninguna prueba real todavía: no hay clientes, testimonios, logos ni métricas reales. Todo lo que hay en la base de datos y en la home (incluida la cita de «Marina Solís · Panadería La Espiga») es de demostración y no puede presentarse como real.
- Cifras de mercado en `docs/NEGOCIO.md`: estimaciones de orden de magnitud, no datos auditados.

## Product Principles

1. El creador primero: sin oferta de creadores no hay marketplace.
2. Honestidad sobre la fase: nada de pruebas sociales, cifras o clientes inventados.
3. Lo local y el engagement importan más que el alcance.
4. Dinero seguro para ambos lados: nadie paga a ciegas ni trabaja sin cobrar.
5. Sin fricción de agencia: precio claro, sin cuotas ni intermediarios.
