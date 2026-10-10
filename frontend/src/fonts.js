/**
 * Inter, servida desde nuestro propio dominio.
 *
 * Antes venia de fonts.googleapis.com, y eso tiene un problema que no es de
 * rendimiento: cargar una fuente desde Google hace que el navegador de cada
 * visitante le mande su IP sin que nadie se lo haya pedido, y eso es una
 * comunicacion de datos a un tercero fuera del EEE. Hay sentencias en Europa
 * que lo han dicho con esas palabras. Autoalojarla lo quita de raiz: deja de
 * haber una peticion que consentir, y de paso desaparece una conexion mas en
 * la ruta critica.
 *
 * Cada fichero declara la fuente por subconjuntos con unicode-range, asi que
 * el navegador solo descarga el latino. Los pesos son los que usa la interfaz
 * (tailwind.config: de normal a black); aniadir uno que no se use solo
 * engordaria el CSS.
 */
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
