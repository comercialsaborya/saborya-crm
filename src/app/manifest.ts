import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Saborya CRM',
    short_name: 'Saborya CRM',
    description: 'CRM comercial: clientes, visitas, pipeline, pedidos e faturamento.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f6f3',
    theme_color: '#17251f',
    lang: 'pt-BR',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Registrar visita', url: '/visitas/nova', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Minhas tarefas', url: '/tarefas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Novo pedido', url: '/pedidos/novo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
