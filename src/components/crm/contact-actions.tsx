import { MapPin, MessageCircle, Phone } from 'lucide-react';
import { mapsLink, telLink, whatsappLink } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Botões grandes de WhatsApp, ligação e mapa (somem quando não há dado). */
export function ContactActions({
  whatsapp,
  phone,
  address,
  size = 'md',
  className,
}: {
  whatsapp?: string | null;
  phone?: string | null;
  address?: (string | null | undefined)[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  const wa = whatsappLink(whatsapp ?? phone);
  const tel = telLink(phone ?? whatsapp);
  const map = address ? mapsLink(address) : null;
  const base =
    size === 'sm'
      ? 'flex size-9 items-center justify-center rounded-lg ring-1 ring-line bg-surface'
      : 'flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold ring-1 ring-line bg-surface sm:flex-none sm:px-4';
  if (!wa && !tel && !map) return null;
  return (
    <div className={cn('flex gap-2', className)}>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(base, 'text-green-700')} aria-label="WhatsApp">
          <MessageCircle className="size-4" />
          {size === 'md' && 'WhatsApp'}
        </a>
      )}
      {tel && (
        <a href={tel} className={cn(base, 'text-nori-800')} aria-label="Ligar">
          <Phone className="size-4" />
          {size === 'md' && 'Ligar'}
        </a>
      )}
      {map && (
        <a href={map} target="_blank" rel="noopener noreferrer" className={cn(base, 'text-blue-700')} aria-label="Abrir no mapa">
          <MapPin className="size-4" />
          {size === 'md' && 'Mapa'}
        </a>
      )}
    </div>
  );
}
