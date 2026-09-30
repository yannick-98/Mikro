import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

export default function NotFound() {
  return (
    <Layout>
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
        <p className="text-[76px] font-black leading-none tracking-tight text-ink/10">404</p>
        <h1 className="mt-4 text-[26px] font-black tracking-tight">Esta pagina no existe</h1>
        <p className="mt-2.5 text-[15px] text-ink/55">
          Puede que el creador haya cambiado su nombre de usuario o que el enlace este mal escrito.
        </p>
        <div className="mt-8 flex gap-3">
          <Link to="/" className="btn-dark">
            Volver al inicio
          </Link>
          <Link to="/rankings" className="btn-ghost">
            Ver rankings
          </Link>
        </div>
      </div>
    </Layout>
  )
}
