// Galería del arte de la demo (lote 4): cada pieza a tamaño de uso o ampliada ×2, en el tema activo.
// Sirve para revisar pieza por pieza en claro y oscuro; no forma parte de la navegación del portal.
import { useState } from 'react';
import { useDemo } from '../../app/store';
import { PageHeader } from '../../ui/kit';
import { BrandMark, PersonAvatar, ProAvatar } from '../../ui/art/brand';
import { CHARACTERS, ToothCharacter, type Mood } from '../../ui/art/characters';
import { DentitionFront } from '../../ui/art/dentition';
import { SPOTS, SpotArt } from '../../ui/art/editorial';
import { Germ, KidTooth, StarArt } from '../../ui/art/kids';
import { APPLIANCES, OrthoArt } from '../../ui/art/ortho';
import { PageArt, type PageArtKind } from '../../ui/art/pages';
import { ServiceArt } from '../../ui/art/services';
import { TOOTH_STATES, ToothArt } from '../../ui/art/teeth';
import { OdontogramArch } from '../../ui/OdontogramArch';

const PAGES: PageArtKind[] = ['reservar', 'turnos', 'chat', 'llamada', 'aprender', 'sede'];
const MOODS: [Mood, string][] = [['feliz', 'feliz'], ['guino', 'guiño'], ['valiente', 'valiente'], ['dormido', 'dormido'], ['sorpresa', 'sorpresa']];
const ANATOMY_NOTE = 'Ilustración esquemática para orientar la lectura. La fidelidad anatómica está pendiente de revisión odontológica; no es material clínico.';

function Piece({ name, use, children }: { name: string; use?: string; children: React.ReactNode }) {
  return (
    <figure className="gal-piece">
      <div className="gal-stage">{children}</div>
      <figcaption><strong>{name}</strong>{use && <span className="small muted">{use}</span>}</figcaption>
    </figure>
  );
}

export function Gallery() {
  const s = useDemo();
  const [big, setBig] = useState(false);
  const chart = s.toothChart.filter((t) => t.personId === 'P-001');
  return (
    <section className={`page gallery${big ? ' is-big' : ''}`}>
      <PageHeader eyebrow="Lote 4 · revisión de arte" title="Galería del arte de la demo"
        actions={<div className="seg" role="group" aria-label="Tamaño"><button type="button" aria-pressed={!big} onClick={() => setBig(false)}>Tamaño de uso</button><button type="button" aria-pressed={big} onClick={() => setBig(true)}>Ampliado ×2</button></div>}>
        Todas las ilustraciones son SVG propios, con los colores del tema: cambiá a oscuro desde la cabecera para revisarlas en los dos modos.
      </PageHeader>

      <section aria-labelledby="g-ed" className="gal-section">
        <h2 id="g-ed">Familia editorial</h2>
        <p className="muted">Línea fina en teal, acentos de oro y papel. Una sola familia para vistas, comprobantes, códigos, campañas, guía, cierre y juegos.</p>
        <div className="gal-grid">{SPOTS.map((p) => <Piece key={p.kind} name={p.label} use={p.use}><SpotArt kind={p.kind} size={big ? 320 : 160} /></Piece>)}</div>
      </section>

      <section aria-labelledby="g-brand" className="gal-section">
        <h2 id="g-brand">Marca y personas</h2>
        <div className="gal-grid">
          <Piece name="Marca" use="Cabecera, pie, chat"><BrandMark size={big ? 96 : 48} /></Piece>
          {s.professionals.slice(0, 4).map((p, i) => <Piece key={p.id} name={p.name} use="Avatar de profesional"><ProAvatar name={p.name} specialty={p.specialty} index={i} size={big ? 112 : 56} /></Piece>)}
          {s.persons.slice(0, 3).map((p) => <Piece key={p.id} name={`${p.firstName} ${p.lastName}`} use="Avatar de persona"><PersonAvatar id={p.id} name={`${p.firstName} ${p.lastName}`} size={big ? 72 : 36} /></Piece>)}
        </div>
      </section>

      <section aria-labelledby="g-pages" className="gal-section">
        <h2 id="g-pages">Encabezados del portal y servicios</h2>
        <div className="gal-grid">
          {PAGES.map((k) => <Piece key={k} name={k} use="Encabezado de página"><div className="gal-page-art"><PageArt kind={k} /></div></Piece>)}
          {s.serviceTypes.map((st) => <Piece key={st.id} name={st.name} use="Servicio"><ServiceArt serviceTypeId={st.id} size={big ? 192 : 96} /></Piece>)}
        </div>
      </section>

      <section aria-labelledby="g-anat" className="gal-section">
        <h2 id="g-anat">Piezas dentales (rigor)</h2>
        <p className="gal-note">{ANATOMY_NOTE}</p>
        <div className="gal-grid gal-teeth">
          {TOOTH_STATES.map((t) => <Piece key={t.state} name={t.label} use={t.detail}><ToothArt kind="molar" state={t.state} width={big ? 96 : 48} /></Piece>)}
        </div>
        <div className="gal-wide"><OdontogramArch dentition="permanente" entries={chart} selected={null} onPick={() => undefined} /></div>
        <div className="gal-grid">
          <Piece name="Sonrisa completa" use="Inicio"><DentitionFront width={big ? 560 : 320} gold /></Piece>
          {APPLIANCES.map((a) => <Piece key={a.id} name={a.label} use="Ortodoncia"><OrthoArt kind={a.id} width={big ? 360 : 200} /></Piece>)}
        </div>
      </section>

      <section aria-labelledby="g-kids" className="gal-section">
        <h2 id="g-kids">Brisa Chicos (caricatura)</h2>
        <p className="muted">Personajes y juego: caricatura sin pretensión anatómica, separada de las piezas de la ficha.</p>
        <div className="gal-grid">
          {CHARACTERS.map((c) => <Piece key={c.id} name={c.name} use={c.tooth}><ToothCharacter who={c.id} size={big ? 200 : 100} /></Piece>)}
          {MOODS.map(([m, label]) => <Piece key={m} name={`Mora · ${label}`} use="Estado de ánimo"><ToothCharacter who="mora" mood={m} size={big ? 160 : 80} /></Piece>)}
          <Piece name="Diente del juego" use="Juego"><div className="gal-box" style={{ width: big ? 96 : 48 }}><KidTooth shine /></div></Piece>
          {[0, 1, 2].map((v) => <Piece key={v} name={`Bichito ${v + 1}`} use="Juego"><div className="gal-box" style={{ width: big ? 96 : 48 }}><Germ variant={v} /></div></Piece>)}
          <Piece name="Estrella" use="Álbum"><div className="gal-box" style={{ width: big ? 80 : 40 }}><StarArt filled /></div></Piece>
        </div>
      </section>
    </section>
  );
}
