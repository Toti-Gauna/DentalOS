// Lote 4 · R-ART-02: todo el arte SVG, renderizado dos veces en el mismo documento, no repite IDs; cada referencia
// url(#…) o href="#…" apunta a un ID existente; los SVG decorativos se ocultan a lectores y los semánticos tienen nombre.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark, PersonAvatar, ProAvatar } from './brand';
import { CHARACTERS, ToothCharacter } from './characters';
import { ArchBackdrop, DentitionFront } from './dentition';
import { SPOTS, SpotArt } from './editorial';
import { GameMouth, Germ, KidTooth, StarArt } from './kids';
import { APPLIANCES, OrthoArt } from './ortho';
import { PageArt, type PageArtKind } from './pages';
import { ServiceArt } from './services';
import { TOOTH_STATES, ToothArt } from './teeth';

const PAGES: PageArtKind[] = ['reservar', 'turnos', 'chat', 'llamada', 'aprender', 'sede'];
const SERVICES = ['ST-PRIMERA', 'ST-CONTROL', 'ST-LIMPIEZA', 'ST-TRAT', 'ST-ORTO-CONS', 'ST-ORTO-CTRL'];

function Everything() {
  return (
    <div>
      {SPOTS.map((s) => <SpotArt key={s.kind} kind={s.kind} />)}
      <SpotArt kind="ticket" title="Ticket de muestra" />
      <BrandMark /><ProAvatar name="Dra. Inés Galván" specialty="ortodoncia" /><PersonAvatar id="P-001" name="Martina Sosa" />
      {CHARACTERS.map((c) => <ToothCharacter key={c.id} who={c.id} />)}
      <DentitionFront gold /><DentitionFront appliance="brackets_metalicos" />
      <svg><ArchBackdrop upper temporal={false} /></svg>
      <KidTooth shine /><Germ variant={1} /><GameMouth /><StarArt filled />
      {APPLIANCES.map((a) => <OrthoArt key={a.id} kind={a.id} />)}
      {PAGES.map((k) => <PageArt key={k} kind={k} />)}
      {SERVICES.map((id) => <ServiceArt key={id} serviceTypeId={id} />)}
      {TOOTH_STATES.map((t) => <ToothArt key={t.state} kind="molar" state={t.state} />)}
    </div>
  );
}

const html = renderToStaticMarkup(<><Everything /><Everything /></>);

describe('arte SVG del lote 4', () => {
  it('no repite IDs aunque cada pieza aparezca dos veces en la página', () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(50);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('cada url(#…) y href="#…" apunta a un ID existente', () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const refs = [...html.matchAll(/url\(#([^)]+)\)/g), ...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(20);
    expect(refs.filter((r) => !ids.has(r))).toEqual([]);
  });

  it('cada <svg> tiene viewBox y es decorativo (aria-hidden) o una imagen con nombre', () => {
    const svgs = [...html.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]).filter((t) => !t.startsWith('<svg>'));
    expect(svgs.length).toBeGreaterThan(40);
    for (const tag of svgs) {
      expect(tag, tag).toMatch(/viewBox="[\d.\s-]+"/);
      const decorative = /aria-hidden="true"/.test(tag);
      const named = /role="img"/.test(tag) && /aria-label(ledby)?="[^"]+"/.test(tag);
      expect(decorative || named, tag).toBe(true);
    }
  });

  it('la familia editorial con título expone el nombre por <title> enlazado', () => {
    const one = renderToStaticMarkup(<SpotArt kind="cierre" title="Cierre comercial de muestra" />);
    const label = /aria-labelledby="([^"]+)"/.exec(one)?.[1];
    expect(label).toBeTruthy();
    expect(one).toContain(`<title id="${label}">Cierre comercial de muestra</title>`);
  });
});
