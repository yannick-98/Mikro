import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout'

/**
 * Aviso legal y politica de privacidad.
 *
 * Los dos documentos describen lo que la aplicacion hace de verdad: los
 * tratamientos salen del esquema de datos y los encargados, de las
 * dependencias reales. Si cambia lo que se guarda o a donde va, esto hay que
 * cambiarlo tambien, porque deja de ser cierto.
 *
 * TITULAR reune en un solo sitio lo unico que no puede salir del codigo.
 */
const TITULAR = {
  // Nombre y apellidos si eres autonomo, razon social si es una sociedad.
  nombre: 'Yannick Castaño David',
  nif: '73101843T',
  // Calle, numero, codigo postal, ciudad y provincia.
  domicilio: 'C/ Mafamude 6, Puebla de Farnals 46139.',
  // A esta direccion llegaran las peticiones de acceso, rectificacion y
  // borrado. Tiene que ser una que leas.
  email: 'auttask.media@gmail.com',
  // Solo si eres sociedad: Registro Mercantil, tomo, folio y hoja. Si eres
  // autonomo, pon: 'No aplica (empresario individual)'.
  registro: 'No aplica (empresario individual)',
  // Ciudad cuyos juzgados conocen de una disputa. Normalmente la tuya.
  ciudad: 'Valencia',
}

const ACTUALIZADO = '11 de octubre de 2026'

function Pendiente({ children }) {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">{children}</span>
  )
}

function Doc({ titulo, entradilla, children }) {
  return (
    <Layout>
      <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-[32px] font-black leading-tight tracking-[-0.03em] sm:text-[38px]">{titulo}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/60">{entradilla}</p>
        <p className="mt-4 text-[13px] font-semibold text-ink/40">Última actualización: {ACTUALIZADO}</p>

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-[13.5px] leading-relaxed text-amber-900">
            <span className="font-bold">Borrador pendiente de revisión.</span> Lo resaltado en
            amarillo son datos que solo puede rellenar el titular. Antes de publicarlo conviene que
            lo revise un abogado: este texto describe con precisión lo que hace la plataforma, pero
            no sustituye a un criterio jurídico.
          </p>
        </div>

        <div className="legal mt-10">{children}</div>

        <p className="mt-12 border-t border-black/[0.07] pt-6 text-[13.5px] text-ink/50">
          ¿Dudas con esto?{' '}
          <Link to="/recursos#contacto" className="font-bold text-brand-600 hover:underline">
            Escríbenos
          </Link>
          .
        </p>
      </div>
    </Layout>
  )
}

function H({ children, id }) {
  return (
    <h2 id={id} className="mt-9 scroll-mt-24 text-[19px] font-extrabold tracking-[-0.02em] first:mt-0">
      {children}
    </h2>
  )
}

function P({ children, className }) {
  return <p className={clsx('mt-3 text-[14.5px] leading-[1.75] text-ink/70', className)}>{children}</p>
}

function Lista({ children }) {
  return <ul className="mt-3 space-y-2 text-[14.5px] leading-[1.7] text-ink/70">{children}</ul>
}

function Li({ children }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink/30" />
      <span>{children}</span>
    </li>
  )
}

function Tabla({ cabeceras, filas }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-black/[0.08]">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="bg-black/[0.03]">
            {cabeceras.map((c) => (
              <th key={c} className="px-4 py-2.5 font-bold text-ink/70">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t border-black/[0.06] align-top">
              {fila.map((celda, j) => (
                <td key={j} className="px-4 py-3 leading-relaxed text-ink/70">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function AvisoLegal() {
  return (
    <Doc
      titulo="Aviso legal"
      entradilla="Quién hay detrás de Mikro y bajo qué condiciones se usa la plataforma."
    >
      <H id="titular">1. Titular</H>
      <P>
        En cumplimiento del artículo 10 de la Ley 34/2002 de servicios de la sociedad de la
        información y de comercio electrónico (LSSI-CE):
      </P>
      <Lista>
        <Li>
          <strong>Titular:</strong> <Pendiente>{TITULAR.nombre}</Pendiente>
        </Li>
        <Li>
          <strong>NIF:</strong> <Pendiente>{TITULAR.nif}</Pendiente>
        </Li>
        <Li>
          <strong>Domicilio:</strong> <Pendiente>{TITULAR.domicilio}</Pendiente>
        </Li>
        <Li>
          <strong>Correo electrónico:</strong> <Pendiente>{TITULAR.email}</Pendiente>
        </Li>
        <Li>
          <strong>Datos registrales:</strong> <Pendiente>{TITULAR.registro}</Pendiente>
        </Li>
        <Li>
          <strong>Sitio web:</strong> mikro-marketplace.netlify.app
        </Li>
      </Lista>

      <H id="objeto">2. Qué es Mikro</H>
      <P>
        Mikro es un mercado que pone en contacto a pequeñas y medianas empresas con creadores de
        contenido. La empresa publica una campaña, los creadores se postulan, las dos partes acuerdan
        un precio y el importe queda retenido hasta que la empresa aprueba el contenido.
      </P>
      <P>
        <strong>Mikro no es parte del acuerdo entre la empresa y el creador.</strong> Es la
        infraestructura donde ese acuerdo se cierra y se paga. La prestación del servicio
        publicitario, su calidad, sus plazos y su contenido son responsabilidad exclusiva de las dos
        partes que lo firman.
      </P>

      <H id="acceso">3. Acceso y cuentas</H>
      <P>
        Navegar por la portada y por el ranking público es libre. Para lo demás hace falta una
        cuenta, y crearla exige ser mayor de edad y tener capacidad para contratar.
      </P>
      <Lista>
        <Li>Los datos que facilites al registrarte deben ser veraces y mantenerse actualizados.</Li>
        <Li>
          Eres responsable de tus credenciales y de lo que se haga con tu cuenta. Avísanos en cuanto
          sospeches que alguien ha entrado sin tu permiso.
        </Li>
        <Li>
          Podemos suspender una cuenta que incumpla estas condiciones, suplante a otra persona o
          falsee sus métricas.
        </Li>
      </Lista>

      <H id="obligaciones">4. Obligaciones de quien usa la plataforma</H>
      <P>
        <strong>Si eres creador:</strong> toda colaboración remunerada o con producto cedido debe
        identificarse como publicidad de forma clara y en el propio contenido, conforme a la Ley
        General de Publicidad, la LSSI-CE y el Código de Conducta sobre el uso de influencers en la
        publicidad. No cumplirlo es responsabilidad tuya y de la marca, no de Mikro. Las métricas que
        publiques en tu perfil deben ser reales.
      </P>
      <P>
        <strong>Si eres empresa:</strong> el brief no puede pedir contenido engañoso, ni publicidad
        encubierta, ni nada contrario a la ley. Si contratas, pagas en los términos acordados.
      </P>

      <H id="propiedad">5. Propiedad intelectual</H>
      <P>
        La marca Mikro, su nombre, su logotipo y el diseño de la plataforma pertenecen al titular. El
        contenido que crea un creador sigue siendo suyo: lo que la empresa obtiene son los derechos
        de uso que ambas partes pacten en cada colaboración, y que quedan reflejados en el acuerdo.
      </P>
      <P>
        Al publicar tu perfil, tus métricas y tu portfolio nos autorizas a mostrarlos dentro de la
        plataforma y en el ranking público, que es la finalidad para la que los subes.
      </P>

      <H id="responsabilidad">6. Responsabilidad</H>
      <P>
        Mikro pone los medios razonables para que la plataforma funcione y para que los perfiles sean
        reales, pero no garantiza la veracidad de todo lo que publican terceros, ni el resultado
        comercial de una campaña, ni la disponibilidad ininterrumpida del servicio.
      </P>
      <P>
        Tampoco respondemos del contenido de los sitios enlazados desde la plataforma (redes
        sociales, webs de las marcas), que no están bajo nuestro control.
      </P>

      <H id="fase">7. Fase actual del servicio</H>
      <P>
        Mikro está en fase de demostración. Los perfiles de creadores, las campañas, las cifras y los
        testimonios que aparecen en la web son <strong>datos de ejemplo</strong> y no corresponden a
        personas, empresas ni colaboraciones reales. No deben interpretarse como prueba de
        resultados.
      </P>

      <H id="ley">8. Ley aplicable</H>
      <P>
        Estas condiciones se rigen por la legislación española. Para cualquier controversia, y cuando
        la normativa de consumo no imponga otro fuero, las partes se someten a los juzgados y
        tribunales de <Pendiente>{TITULAR.ciudad}</Pendiente>.
      </P>
    </Doc>
  )
}

// ---------------------------------------------------------------------------

export function Privacidad() {
  return (
    <Doc
      titulo="Política de privacidad"
      entradilla="Qué datos tratamos, por qué, cuánto tiempo y quién más los ve. Escrito sobre lo que la plataforma guarda de verdad."
    >
      <H id="responsable">1. Responsable del tratamiento</H>
      <Lista>
        <Li>
          <strong>Responsable:</strong> <Pendiente>{TITULAR.nombre}</Pendiente> (
          <Pendiente>{TITULAR.nif}</Pendiente>)
        </Li>
        <Li>
          <strong>Domicilio:</strong> <Pendiente>{TITULAR.domicilio}</Pendiente>
        </Li>
        <Li>
          <strong>Contacto en materia de protección de datos:</strong>{' '}
          <Pendiente>{TITULAR.email}</Pendiente>
        </Li>
      </Lista>
      <P>
        No hay delegado de protección de datos designado. Por el volumen y el tipo de tratamiento no
        es obligatorio; si eso cambia, se nombrará y se indicará aquí.
      </P>

      <H id="datos">2. Qué datos tratamos y para qué</H>
      <Tabla
        cabeceras={['Finalidad', 'Datos', 'Base jurídica', 'Conservación']}
        filas={[
          [
            'Crear y mantener tu cuenta',
            'Nombre, correo electrónico, contraseña (guardada cifrada, nunca en claro), rol e imagen de perfil.',
            'Ejecución del contrato (art. 6.1.b RGPD).',
            'Mientras la cuenta esté activa y 3 años después, por si surge una reclamación.',
          ],
          [
            'Perfil público de creador',
            'Nombre público, usuario, biografía, ciudad y provincia, categoría, idiomas, redes conectadas y sus métricas, tarifas, portfolio y datos agregados de audiencia (franja de edad, reparto por sexo, país). Son estadísticas del conjunto de tu audiencia, no datos de tus seguidores.',
            'Ejecución del contrato: sin perfil no hay marketplace.',
            'Mientras mantengas el perfil.',
          ],
          [
            'Perfil de empresa',
            'Nombre comercial, sector, ciudad, web, NIF, tamaño del equipo y presupuesto orientativo.',
            'Ejecución del contrato.',
            'Mientras la cuenta esté activa y 3 años después.',
          ],
          [
            'Ranking público',
            'Nombre público, usuario, categoría, ciudad, seguidores, engagement y puntuación de los diez primeros.',
            'Interés legítimo en mostrar el servicio, y ejecución del contrato para quien se registra sabiendo que el ranking es público.',
            'Se recalcula de forma continua.',
          ],
          [
            'Gestionar colaboraciones',
            'Candidaturas, acuerdos, importes, mensajes entre las partes y valoraciones.',
            'Ejecución del contrato.',
            'Durante la colaboración y 5 años después (plazos de prescripción civil y mercantil).',
          ],
          [
            'Obligaciones fiscales y contables',
            'Datos de facturación de las operaciones con comisión.',
            'Obligación legal (art. 6.1.c RGPD).',
            '6 años (Código de Comercio) y 4 años (Ley General Tributaria), el que sea mayor.',
          ],
          [
            'Peticiones de demo desde la portada',
            'Empresa, nombre de contacto, correo, teléfono, sector, ciudad, tamaño, presupuesto, objetivo y la fecha en que diste tu permiso.',
            'Consentimiento (art. 6.1.a RGPD), que puedes retirar cuando quieras.',
            '1 año desde el último contacto, o antes si lo pides.',
          ],
          [
            'Tienda de Shopify conectada',
            'Dominio, nombre y correo de la tienda, y las credenciales de acceso. De cada pedido atribuido guardamos importe, moneda, fecha y el código de descuento usado.',
            'Ejecución del contrato con la empresa.',
            'Mientras la app esté instalada. Al desinstalar, borramos los datos de la tienda.',
          ],
          [
            'Seguridad y funcionamiento',
            'Dirección IP y registros técnicos del servidor y del CDN.',
            'Interés legítimo en que el servicio funcione y no sufra abusos (art. 6.1.f RGPD).',
            'El plazo de retención de registros de nuestros proveedores.',
          ],
        ]}
      />
      <P>
        <strong>Lo que no tratamos.</strong> No pedimos ni guardamos datos de los clientes de las
        tiendas conectadas: la integración con Shopify no solicita permiso de clientes y de cada
        pedido solo se queda el importe y el código. Tampoco tratamos categorías especiales de datos
        (salud, ideología, origen étnico); no los pidas en un brief ni los publiques en tu perfil.
      </P>

      <H id="origen">3. De dónde salen los datos</H>
      <P>
        De ti, en todos los casos: al registrarte, al completar tu perfil, al escribir en la
        plataforma o al rellenar el formulario de demo. Las métricas de redes que muestres en tu
        perfil las aportas tú; hoy no las verificamos automáticamente contra las plataformas, y así
        se indica en tu ficha.
      </P>

      <H id="destinatarios">4. Quién más ve tus datos</H>
      <P>
        <strong>La otra parte de una colaboración.</strong> Si eres creador, la empresa con la que
        trabajas ve tu perfil, tus métricas y vuestros mensajes. Si eres empresa, el creador ve tu
        ficha y tu brief. Esto es el servicio, no una cesión aparte.
      </P>
      <P>
        <strong>Cualquier visitante</strong> ve el ranking público: los diez primeros creadores, con
        los datos indicados arriba.
      </P>
      <P>
        <strong>Proveedores que tratan datos por nuestra cuenta</strong>, con contrato de encargado
        de tratamiento:
      </P>
      <Tabla
        cabeceras={['Proveedor', 'Para qué', 'Dónde']}
        filas={[
          ['Supabase', 'Base de datos', 'Irlanda (Unión Europea)'],
          ['Netlify', 'Alojamiento web y servidor de la API', 'Estados Unidos y red de distribución global'],
          [
            'Shopify',
            'Solo si conectas una tienda: la app se comunica con tu tienda',
            'Según la ubicación de tu tienda',
          ],
        ]}
      />
      <P>
        No vendemos ni cedemos tus datos a nadie con fines publicitarios. Fuera de lo anterior, solo
        los comunicaríamos a la Administración o a los tribunales si una norma nos obligara.
      </P>

      <P>
        <strong>Si conectas una red social</strong> (opcional, y solo si tú lo pides): guardamos el
        identificador de tu cuenta, tu número de seguidores y, de tus últimas publicaciones, la
        fecha, el enlace, la miniatura y los contadores de likes, comentarios y visualizaciones. Lo
        usamos para calcular tu engagement y tu frecuencia de publicación. El permiso que pedimos
        es de solo lectura: no publicamos nada ni accedemos a tus mensajes. Guardamos también el
        token de acceso, cifrado. Si desconectas la cuenta, borramos todo eso.
      </P>

      <H id="transferencias">5. Transferencias fuera del Espacio Económico Europeo</H>
      <P>
        La base de datos está en Irlanda, dentro de la Unión Europea: tus datos no salen del EEE
        para almacenarse. Lo que sí implica tratamiento fuera es el alojamiento de la web y de la
        API, y la conexión con Shopify si decides usarla. En los dos casos hay un mecanismo de
        transferencia previsto en el RGPD:
      </P>
      <Tabla
        cabeceras={['Proveedor', 'Mecanismo', 'Base']}
        filas={[
          [
            'Netlify',
            'Marco de Privacidad de Datos UE-EEUU',
            'Entidad certificada, con las cláusulas contractuales tipo de 2021 en su contrato de encargado como respaldo',
          ],
          [
            'Shopify',
            'Normas Corporativas Vinculantes',
            'Los datos del EEE los trata Shopify International Ltd. (Irlanda); sus transferencias internas se amparan en sus NCV aprobadas, con las cláusulas de 2021 como salvaguarda adicional',
          ],
          [
            'Meta, TikTok y Google',
            'Solo si conectas esa red',
            'Al conectar una cuenta, nuestro servidor habla con su API para leer tus cifras. La relación con esa plataforma es tuya y se rige por sus condiciones; nosotros solo usamos el permiso que tú das y puedes retirarlo cuando quieras',
          ],
        ]}
      />
      <P>
        La tipografía de la web se sirve desde nuestro propio dominio. No hay ninguna petición a
        servidores de Google al abrir la página, ni, por tanto, comunicación de tu IP a Google.
      </P>

      <H id="cookies">6. Cookies y almacenamiento en tu navegador</H>
      <P>
        <strong>Mikro no usa cookies.</strong> No hay analítica, ni píxeles, ni rastreadores de
        terceros, ni perfilado publicitario. Por eso tampoco verás un banner de cookies: no hay nada
        que consentir.
      </P>
      <P>
        Lo único que guardamos en tu navegador es tu identificador de sesión (
        <code className="rounded bg-black/5 px-1.5 py-0.5 text-[13px]">mikro.token</code>, en el
        almacenamiento local), necesario para mantenerte dentro de tu cuenta. Se borra al cerrar
        sesión. Al ser estrictamente necesario, no requiere consentimiento.
      </P>
      <P>
        Tampoco se carga nada desde servidores de terceros al abrir la página: la tipografía viaja
        desde nuestro propio dominio, precisamente para que tu navegador no tenga que anunciar tu
        dirección IP a nadie más.
      </P>

      <H id="automatizadas">7. El ranking es un cálculo automático</H>
      <P>
        La posición de un creador la decide una fórmula, no una persona. Pondera engagement (34%),
        número de seguidores en escala logarítmica (20%), valoraciones recibidas (18%),
        colaboraciones cerradas (12%), rapidez de respuesta (8%) y confianza del perfil (8%).
      </P>
      <P>
        Dentro de ese último 8% pesa más tener las cifras comprobadas que la identidad verificada:
        un perfil con las redes conectadas puntúa 85 sobre 100, uno solo con la identidad
        verificada 70, y uno con las dos cosas, 100. Es deliberado: lo que una marca contrata son
        las cifras, y las que vienen de la propia plataforma no se pueden inflar. Si tus cifras las
        has escrito tú, se muestran como declaradas y puntúan 40.
      </P>
      <P>
        No produce efectos jurídicos ni decide sobre el acceso al servicio: afecta al orden en que
        apareces. Aun así lo contamos con los pesos concretos, porque te afecta y tienes derecho a
        entenderlo. Si crees que tu puntuación es incorrecta, escríbenos y la revisa una persona.
      </P>

      <H id="derechos">8. Tus derechos</H>
      <P>
        Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión,
        oposición, limitación del tratamiento y portabilidad, así como retirar el consentimiento que
        hayas dado, sin que la retirada afecte a lo tratado antes.
      </P>
      <P>
        Escribe a <Pendiente>{TITULAR.email}</Pendiente> indicando qué derecho ejerces. Responderemos
        en el plazo máximo de un mes. Si consideras que no hemos atendido bien tu petición, puedes
        reclamar ante la Agencia Española de Protección de Datos (
        <a href="https://www.aepd.es" className="font-semibold text-brand-600 hover:underline" target="_blank" rel="noreferrer">
          aepd.es
        </a>
        ).
      </P>
      <P>
        En el caso concreto de las peticiones de demo, el formulario promete que borramos tus datos
        si lo pides, y se cumple: el backoffice permite eliminar la petición completa.
      </P>

      <H id="menores">9. Menores de edad</H>
      <P>
        La plataforma no está dirigida a menores de 18 años, porque usarla implica contratar y
        cobrar. Si detectamos una cuenta de un menor, la eliminaremos.
      </P>

      <H id="seguridad">10. Seguridad</H>
      <P>
        Las contraseñas se guardan cifradas con bcrypt y nunca en claro, ni siquiera nosotros podemos
        leerlas. El tráfico va siempre por HTTPS y el acceso a la base de datos está restringido. Los
        webhooks de Shopify se verifican por firma antes de procesarse, de modo que nadie pueda
        inyectar datos haciéndose pasar por Shopify.
      </P>
      <P>
        Ningún sistema es infalible. Si se produjera una brecha que suponga un riesgo para tus
        derechos, te lo comunicaremos y lo notificaremos a la AEPD en los plazos del RGPD.
      </P>

      <H id="cambios">11. Cambios en esta política</H>
      <P>
        Si cambia lo que hacemos con los datos, cambiará este texto y actualizaremos la fecha de
        arriba. Si el cambio es relevante, te avisaremos por correo o dentro de la plataforma.
      </P>
    </Doc>
  )
}

export default AvisoLegal
