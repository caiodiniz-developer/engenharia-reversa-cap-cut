import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToasts } from './toasts';

beforeEach(() => {
  vi.useFakeTimers();
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe('avisos', () => {
  it('erro dura mais que informação e sucesso', () => {
    toast.error('falhou');
    toast.info('olha');
    toast.success('feito');
    expect(useToasts.getState().toasts.map((t) => [t.kind, t.ttl])).toEqual([['error', 6000], ['info', 3500], ['success', 3500]]);
  });

  it('mantém só os cinco mais recentes', () => {
    for (let i = 1; i <= 8; i++) toast.info('aviso ' + i);
    const msgs = useToasts.getState().toasts.map((t) => t.message);
    expect(msgs).toHaveLength(5);
    expect(msgs[0]).toBe('aviso 4');
    expect(msgs[4]).toBe('aviso 8');
  });

  it('some sozinho depois do tempo e pode ser dispensado antes', () => {
    toast.info('rápido');
    toast.error('demora');
    vi.advanceTimersByTime(3499);
    expect(useToasts.getState().toasts).toHaveLength(2);
    vi.advanceTimersByTime(2);
    expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['demora']);
    useToasts.getState().dismiss(useToasts.getState().toasts[0]!.id);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});
