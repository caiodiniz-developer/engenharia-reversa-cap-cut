import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToasts } from './toasts';

beforeEach(() => {
  vi.useFakeTimers();
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe('aviso com ação', () => {
  it('guarda a ação e dura 6 s em vez de 3,5 s', () => {
    const run = vi.fn();
    toast.success('feito', { label: 'Desfazer', run });
    const t = useToasts.getState().toasts[0]!;
    expect(t.ttl).toBe(6000);
    expect(t.action?.label).toBe('Desfazer');
    t.action!.run();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5999);
    expect(useToasts.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('sem ação continua com o tempo e sem botão', () => {
    toast.success('feito');
    const t = useToasts.getState().toasts[0]!;
    expect(t.ttl).toBe(3500);
    expect(t.action).toBeUndefined();
  });
});
