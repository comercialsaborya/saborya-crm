import { describe, expect, it } from 'vitest';
import {
  calcLineSubtotal,
  calcOrderSubtotal,
  calcOrderTotal,
  companySchema,
  isValidCNPJ,
  orderSchema,
  parseDecimal,
  visitSchema,
  zodFieldErrors,
} from '@/lib/validation';

describe('parseDecimal', () => {
  it('entende formatos brasileiros', () => {
    expect(parseDecimal('1.234,56')).toBe(1234.56);
    expect(parseDecimal('R$ 18.500')).toBe(18500);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('1234.5')).toBe(1234.5);
    expect(parseDecimal('')).toBeNull();
    expect(Number.isNaN(parseDecimal('abc'))).toBe(true);
  });
});

describe('CNPJ', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('11222333000182')).toBe(false);
    expect(isValidCNPJ('00000000000000')).toBe(false);
    expect(isValidCNPJ('123')).toBe(false);
  });
});

describe('cálculo do pedido', () => {
  const items = [
    { quantity: 100, unit_price: 10 },
    { quantity: 50, unit_price: 20 },
    { quantity: 3, unit_price: 9.99 },
  ];
  it('quantidade × preço = subtotal', () => {
    expect(calcLineSubtotal(3, 9.99)).toBe(29.97);
    expect(calcOrderSubtotal(items)).toBe(2029.97);
  });
  it('subtotal − desconto = total, nunca negativo', () => {
    expect(calcOrderTotal(items, 29.97)).toBe(2000);
    expect(calcOrderTotal(items, 999999)).toBe(0);
  });
});

describe('schemas', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  it('cliente: razão social obrigatória e CNPJ válido', () => {
    const bad = companySchema.safeParse({ legal_name: '', client_type: 'outro', status: 'frio', cnpj: '123' });
    expect(bad.success).toBe(false);
    const errs = zodFieldErrors(bad.error!);
    expect(errs.legal_name).toBeDefined();
    expect(errs.cnpj).toBeDefined();
    const ok = companySchema.safeParse({ legal_name: 'Rede X', client_type: 'rede_supermercado', status: 'frio', cnpj: '11.222.333/0001-81', email: '' });
    expect(ok.success).toBe(true);
    expect(ok.data?.cnpj).toBe('11222333000181');
    expect(ok.data?.email).toBeNull();
  });
  it('pedido: exige item e bloqueia desconto maior que subtotal e produto repetido', () => {
    const base = { company_id: uuid, order_date: '2026-10-01', status: 'pedido_realizado' };
    expect(orderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    const big = orderSchema.safeParse({ ...base, discount: '500', items: [{ product_id: uuid, quantity: '10', unit_price: '5' }] });
    expect(big.success).toBe(false);
    const dup = orderSchema.safeParse({
      ...base,
      items: [
        { product_id: uuid, quantity: 1, unit_price: 1 },
        { product_id: uuid, quantity: 2, unit_price: 1 },
      ],
    });
    expect(dup.success).toBe(false);
    const ok = orderSchema.safeParse({ ...base, discount: '10,00', items: [{ product_id: uuid, quantity: '10', unit_price: '5,50' }] });
    expect(ok.success).toBe(true);
  });
  it('visita: resultado obrigatório; localização opcional', () => {
    const v = { company_id: uuid, visit_date: '2026-10-01', visit_time: '10:30', visit_type: 'follow_up', product_ids: [] };
    expect(visitSchema.safeParse(v).success).toBe(false);
    const ok = visitSchema.safeParse({ ...v, result: 'interessado', latitude: '', create_follow_up: 'on' });
    expect(ok.success).toBe(true);
    expect(ok.data?.latitude).toBeNull();
    expect(ok.data?.create_follow_up).toBe(true);
  });
});
