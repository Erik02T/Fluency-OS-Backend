import {
  addDays,
  dayOfWeek,
  formatDateLabel,
  todayInTz,
  weekNumberFor,
  weekRangeOf,
} from './planner-date.util';

describe('planner-date.util', () => {
  it('addDays soma e subtrai cruzando meses/anos', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', 0)).toBe('2026-03-01');
  });

  it('dayOfWeek retorna 0 no domingo', () => {
    expect(dayOfWeek('2026-10-04')).toBe(0); // domingo
    expect(dayOfWeek('2026-10-10')).toBe(6); // sábado
  });

  it('weekRangeOf devolve domingo → sábado da semana da data', () => {
    // 2026-10-10 (sábado) → semana 2026-10-04 (dom) a 2026-10-10 (sáb)
    expect(weekRangeOf('2026-10-10')).toEqual({
      startDate: '2026-10-04',
      endDate: '2026-10-10',
    });
    // 2026-10-07 (quarta) → 2026-10-04 a 2026-10-10
    expect(weekRangeOf('2026-10-07')).toEqual({
      startDate: '2026-10-04',
      endDate: '2026-10-10',
    });
  });

  it('weekNumberFor é compatível com o cálculo do frontend (ceil(dias/7), min 1)', () => {
    expect(weekNumberFor('2026-01-01')).toBe(1); // diff 0 → max(1, 0)
    expect(weekNumberFor('2026-01-08')).toBe(1); // diff 7 → ceil(1) = 1
    expect(weekNumberFor('2026-01-09')).toBe(2); // diff 8 → ceil(1.14) = 2
    expect(weekNumberFor('2026-12-31')).toBe(52); // diff 364 → ceil(52) = 52
  });

  it('todayInTz respeita o timezone do usuário', () => {
    // 2026-01-01T02:00Z ainda é 2025-12-31 em São Paulo (UTC-3)
    const now = new Date('2026-01-01T02:00:00Z');
    expect(todayInTz('America/Sao_Paulo', now)).toBe('2025-12-31');
    expect(todayInTz('UTC', now)).toBe('2026-01-01');
  });

  it('formatDateLabel formata em pt-BR com inicial maiúscula', () => {
    const label = formatDateLabel('2026-10-10');
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    expect(label).toContain('10');
  });

  it('todayInTz cai para timezone inválido sem lançar', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(() => todayInTz('Invalid/Zone', now)).not.toThrow();
  });
});
