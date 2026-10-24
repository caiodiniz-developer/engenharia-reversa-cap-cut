/** Erro de operação inválida na timeline (sobreposição, faixa bloqueada, limites de mídia...). */
export class TimelineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'OVERLAP'
      | 'LOCKED'
      | 'INVALID'
      | 'KIND_MISMATCH'
      | 'OUT_OF_RANGE',
  ) {
    super(message);
    this.name = 'TimelineError';
  }
}
