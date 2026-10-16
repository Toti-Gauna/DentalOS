import { Link } from 'react-router-dom'
import { Empty } from '../ui/kit'
import { PageHead } from '../ui/Shell'

export function NotFound({ what = 'página', back = '/', backLabel = 'Volver al inicio' }: { what?: string; back?: string; backLabel?: string }) {
  return (
    <main className="wrap">
      <PageHead title={`No encontramos esa ${what}`} />
      <Empty title="Este enlace no lleva a ningún registro" action={<Link className="btn" to={back}>{backLabel}</Link>}>
        El identificador puede ser de otro perfil, de un seed anterior o estar mal escrito. No se creó ni modificó nada.
      </Empty>
    </main>
  )
}
