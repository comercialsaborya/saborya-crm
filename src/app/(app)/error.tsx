'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar esta tela</h1>
      <p className="mt-2 text-sm text-muted">
        Verifique sua conexão e tente de novo. Se continuar, avise a gestão informando o código abaixo.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">{error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  );
}
