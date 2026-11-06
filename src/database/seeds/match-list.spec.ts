import { argValue, coreName, normaliseName, parseEsoOverrides, resolveEso, type EsoRecord } from './match-list';
import { SELECTED_ESOS } from './data/selected-esos';

const PAIRABLE = ['VALIDATED_SHORTLISTED', 'MATCHED'];

const rec = (id: string, name: string, status = 'VALIDATED_SHORTLISTED', ref = `REF-${id}`): EsoRecord => ({
  id,
  applicationRef: ref,
  organisationLegalName: name,
  status,
  finalScorePercent: 80,
  state: 'Kwara',
});

describe('match list name rules', () => {
  it('normalises case, punctuation, ampersands, brackets and Ltd', () => {
    expect(normaliseName('Gogetit Investments Ltd')).toBe('gogetit investments limited');
    expect(normaliseName('University of Ilorin (UNILORIN)')).toBe('university of ilorin');
    expect(normaliseName('Mentor-Box Foundation')).toBe('mentor box foundation');
    expect(normaliseName('R & D Hub')).toBe('r and d hub');
  });

  it('drops trailing company suffixes but never the whole name', () => {
    expect(coreName('Ilorin Innovation Hub Ltd/GTE')).toBe('ilorin innovation hub');
    expect(coreName('O2INNOVATIONS LAB NIG. LTD')).toBe('o2innovations lab');
    expect(coreName('Limited')).toBe('limited');
    expect(coreName('Wootlab Foundation')).toBe('wootlab foundation');
  });

  it('resolves an exact name first', () => {
    const r = resolveEso('Wootlab Foundation', [rec('1', 'Wootlab Foundation'), rec('2', 'Wootlab Foundation Labs')], PAIRABLE);
    expect(r).toMatchObject({ ok: true, kind: 'exact', record: { id: '1' } });
  });

  it('resolves Ltd against Limited and a missing Ltd/GTE suffix', () => {
    expect(resolveEso('Gogetit Investments Ltd', [rec('1', 'Gogetit Investments Limited')], PAIRABLE)).toMatchObject({
      ok: true,
      kind: 'exact',
    });
    expect(resolveEso('Ilorin Innovation Hub', [rec('1', 'Ilorin Innovation Hub Ltd/GTE')], PAIRABLE)).toMatchObject({
      ok: true,
      kind: 'company-suffix',
    });
  });

  it('resolves a short name to a longer registered name only when it is the only one', () => {
    expect(resolveEso('nHub', [rec('1', 'nHub Incubator And Accelerator LTD')], PAIRABLE)).toMatchObject({
      ok: true,
      kind: 'longer-registered-name',
    });
    const two = resolveEso('nHub', [rec('1', 'nHub Incubator'), rec('2', 'nHub Labs')], PAIRABLE);
    expect(two.ok).toBe(false);
  });

  it('does not treat a different word that starts the same as a match', () => {
    expect(resolveEso('nHub', [rec('1', 'nHubs Collective')], PAIRABLE).ok).toBe(false);
  });

  it('prefers the one validated application when the same organisation applied more than once', () => {
    const r = resolveEso('Codextel Limited', [rec('1', 'Codextel Limited', 'REJECTED'), rec('2', 'Codextel Limited')], PAIRABLE);
    expect(r).toMatchObject({ ok: true, record: { id: '2' }, others: [{ id: '1' }] });
  });

  it('refuses when two validated applications share the name', () => {
    const r = resolveEso('Codextel Limited', [rec('1', 'Codextel Limited'), rec('2', 'Codextel Ltd', 'MATCHED')], PAIRABLE);
    expect(r.ok).toBe(false);
  });

  it('reports a name it cannot find, with nearby names', () => {
    const r = resolveEso('Kogi Innovation Hub', [rec('1', 'Kogi Tech Hub'), rec('2', 'Wootlab Foundation')], PAIRABLE);
    expect(r).toMatchObject({ ok: false, candidates: [{ id: '1' }] });
  });

  it('uses an explicit application reference when given', () => {
    const records = [rec('1', 'Kogi Tech Hub', 'VALIDATED_SHORTLISTED', 'ESO-0042')];
    expect(resolveEso('Kogi Innovation Hub', records, PAIRABLE, 'eso-0042')).toMatchObject({ ok: true, kind: 'reference' });
    expect(resolveEso('Kogi Innovation Hub', records, PAIRABLE, 'ESO-9999').ok).toBe(false);
  });

  it('reads --eso overrides and plain arguments', () => {
    const args = ['--apply', '--eso', 'Kogi Innovation Hub=ESO-0042', '--eso=nHub=ESO-7', '--admin=a@b.ng'];
    const overrides = parseEsoOverrides(args);
    expect(overrides.get('kogi innovation hub')).toBe('ESO-0042');
    expect(overrides.get('nhub')).toBe('ESO-7');
    expect(argValue(args, 'admin')).toBe('a@b.ng');
    expect(() => parseEsoOverrides(['--eso', 'no-reference'])).toThrow();
  });
});

describe('selected ESOs list', () => {
  it('has the 11 centres once each, with 7 ESOs', () => {
    expect(SELECTED_ESOS).toHaveLength(11);
    expect(new Set(SELECTED_ESOS.map((r) => r.institutionId)).size).toBe(11);
    expect(new Set(SELECTED_ESOS.map((r) => normaliseName(r.esoName))).size).toBe(7);
  });
});
