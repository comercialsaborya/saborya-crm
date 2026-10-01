import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sem conexão' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
      <h1 className="text-xl font-semibold">Sem conexão com a internet</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        O CRM precisa de internet para salvar visitas e pedidos com segurança. Assim que o sinal voltar, recarregue a página.
      </p>
      {/* Recarga completa (não navegação do cliente) para testar a conexão. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-6 rounded-lg bg-nori-900 px-5 py-3 text-sm font-semibold text-white">
        Tentar novamente
      </a>
    </main>
  );
}
