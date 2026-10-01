import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  Contact,
  FileClock,
  Filter,
  Gauge,
  Home,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Target,
  Users,
  Activity,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };
export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { href: '/', label: 'Início', icon: Home },
      { href: '/tarefas', label: 'Minhas tarefas', icon: CalendarCheck },
    ],
  },
  {
    label: 'Relacionamento',
    items: [
      { href: '/clientes', label: 'Clientes', icon: Building2 },
      { href: '/contatos', label: 'Compradores', icon: Contact },
      { href: '/pipeline', label: 'Pipeline', icon: Target },
      { href: '/visitas', label: 'Visitas', icon: MapPin },
      { href: '/atividades', label: 'Atividades', icon: Activity },
    ],
  },
  {
    label: 'Vendas',
    items: [
      { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
      { href: '/faturamento', label: 'Faturamento', icon: Receipt },
    ],
  },
  {
    label: 'Análise',
    items: [
      { href: '/funil', label: 'Saúde do funil', icon: Filter },
      { href: '/volume', label: 'Volume vendido', icon: BarChart3 },
      { href: '/desempenho', label: 'Desempenho', icon: Gauge, adminOnly: true },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/produtos', label: 'Produtos', icon: Package },
      { href: '/equipe', label: 'Equipe', icon: Users, adminOnly: true },
      { href: '/auditoria', label: 'Auditoria', icon: FileClock, adminOnly: true },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export const QUICK_ACTIONS = [
  { href: '/visitas/nova', label: 'Nova visita', icon: MapPin, primary: true },
  { href: '/clientes/novo', label: 'Novo cliente', icon: Building2 },
  { href: '/contatos/novo', label: 'Novo comprador', icon: Contact },
  { href: '/oportunidades/nova', label: 'Nova oportunidade', icon: Target },
  { href: '/pedidos/novo', label: 'Novo pedido', icon: ShoppingCart },
  { href: '/atividades/nova', label: 'Nova atividade', icon: ClipboardList },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
