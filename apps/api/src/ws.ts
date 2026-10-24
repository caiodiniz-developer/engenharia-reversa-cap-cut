import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import type { AppContext } from './http';
import { verifyToken } from './security';

/**
 * WebSocket em /ws. Autenticação pela primeira mensagem {"type":"auth","token":"..."} (o token não vai na URL,
 * evitando que apareça em logs). Depois disso o cliente recebe os eventos de tarefas/mídia do próprio usuário.
 */
export function attachWebSocket(server: Server, ctx: AppContext): () => void {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (socket, req) => {
    const origin = req.headers.origin;
    if (origin && !ctx.config.corsOrigins.includes(origin)) {
      socket.close(4403, 'origin');
      return;
    }
    let unsubscribe: (() => void) | undefined;
    const deadline = setTimeout(() => socket.close(4401, 'auth timeout'), 5000);
    socket.on('message', (raw) => {
      if (unsubscribe) return;
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
        const claims = msg.type === 'auth' && msg.token ? verifyToken(msg.token, ctx.config.jwtSecret) : undefined;
        if (!claims) return socket.close(4401, 'unauthorized');
        clearTimeout(deadline);
        unsubscribe = ctx.events.subscribe(claims.sub, (event) => {
          if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
        });
        socket.send(JSON.stringify({ type: 'ready' }));
      } catch {
        socket.close(4400, 'bad message');
      }
    });
    socket.on('close', () => {
      clearTimeout(deadline);
      unsubscribe?.();
    });
  });
  return () => wss.close();
}
