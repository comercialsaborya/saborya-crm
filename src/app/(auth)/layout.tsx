export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-nori-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo light />
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-tight tracking-tight">
            Cada visita, cada comprador e cada pedido no mesmo lugar.
          </p>
          <p className="mt-4 text-white/70">
            Registre a visita na porta do cliente. A gestão acompanha em tempo real.
          </p>
        </div>
        <RiceGrid />
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <path d="M16 3 L29 26 Q29 29 26 29 L6 29 Q3 29 3 26 Z" fill={light ? '#f5f6f3' : '#17251f'} />
        <rect x="9" y="19" width="14" height="10" rx="1.5" fill={light ? '#22352d' : '#c8364a'} />
      </svg>
      <span className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Saborya CRM</span>
    </div>
  );
}

/** Textura discreta de "grãos de arroz" no painel lateral. */
function RiceGrid() {
  return (
    <svg className="absolute -right-24 bottom-24 h-80 w-80 opacity-[0.08]" viewBox="0 0 200 200" aria-hidden>
      {Array.from({ length: 64 }).map((_, i) => (
        <ellipse
          key={i}
          cx={12 + (i % 8) * 25}
          cy={12 + Math.floor(i / 8) * 25}
          rx="7"
          ry="3.5"
          transform={`rotate(${(i * 37) % 180} ${12 + (i % 8) * 25} ${12 + Math.floor(i / 8) * 25})`}
          fill="white"
        />
      ))}
    </svg>
  );
}
