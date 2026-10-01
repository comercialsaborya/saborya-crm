import { describe, expect, it } from 'vitest';
import { resolvePeriod } from '@/lib/periods';
import { addDaysISO, formatBRL, formatCNPJ, formatPhone, localDateTimeToISO, todayISO, whatsappLink } from '@/lib/format';
import { toCsv } from '@/lib/csv';
import { describeAudit } from '@/lib/feed';
import type { AuditRow } from '@/types/db';

describe('períodos', () => {
  const today = '2026-10-15'; // quinta-feira
  it('presets', () => {
    expect(resolvePeriod({ periodo: 'hoje' }, 'mes', today)).toMatchObject({ from: today, to: today });
    expect(resolvePeriod({ periodo: 'semana' }, 'mes', today)).toMatchObject({ from: '2026-10-12', to: '2026-10-18' });
    expect(resolvePeriod({}, 'mes', today)).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(resolvePeriod({ periodo: 'mes_anterior' }, 'mes', today)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(resolvePeriod({ periodo: '3m' }, 'mes', today)).toMatchObject({ from: '2026-08-01', to: today });
    expect(resolvePeriod({ periodo: '12m' }, 'mes', '2026-01-10')).toMatchObject({ from: '2025-02-01', to: '2026-01-10' });
  });
  it('personalizado com datas invertidas é corrigido', () => {
    expect(resolvePeriod({ periodo: 'personalizado', de: '2026-09-30', ate: '2026-09-01' }, 'mes', today)).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });
});

describe('formatação', () => {
  it('moeda, CNPJ e telefone', () => {
    expect(formatBRL(18500)).toMatch(/R\$\s?18\.500,00/);
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('5511987654321')).toBe('(11) 98765-4321');
  });
  it('WhatsApp assume Brasil', () => {
    expect(whatsappLink('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(whatsappLink('')).toBeNull();
  });
  it('datas no fuso de São Paulo', () => {
    expect(todayISO(new Date('2026-10-02T01:30:00Z'))).toBe('2026-10-01');
    expect(localDateTimeToISO('2026-10-01', '10:32')).toBe('2026-10-01T13:32:00.000Z');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('CSV', () => {
  it('BOM, separador ; e proteção contra fórmula', () => {
    const csv = toCsv([{ a: 'x;y', b: 1234.5, c: '=HYPERLINK()' }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
      { header: 'C', value: (r) => r.c },
    ]);
    expect(csv.startsWith('﻿A;B;C')).toBe(true);
    expect(csv).toContain('"x;y";1234,50;\'=HYPERLINK()');
  });
});

describe('feed de atividades', () => {
  const base: AuditRow = {
    id: 1, table_name: 'visits', record_id: 'r', action: 'insert', actor_id: 'u', actor_name: 'João',
    company_id: 'c', company_label: 'Carrefour', changed_fields: null, old_data: null, new_data: {}, created_at: '2026-10-01T13:32:00Z',
  };
  it('frases no formato pedido', () => {
    expect(describeAudit(base)?.text).toBe('João visitou Carrefour');
    expect(describeAudit({ ...base, table_name: 'contacts', new_data: { name: 'Maria' } })?.text).toBe('João cadastrou o comprador Maria (Carrefour)');
    expect(describeAudit({ ...base, table_name: 'orders', action: 'status_change', new_data: { status: 'faturado', order_number: 1032, total: 7850 } })?.text).toMatch(
      /^Pedido #1032 faturado — R\$\s?7\.850,00$/,
    );
    expect(describeAudit({ ...base, table_name: 'opportunities', new_data: { estimated_value: 18500 } })?.text).toMatch(/registrou oportunidade de R\$\s?18\.500,00/);
  });
});
