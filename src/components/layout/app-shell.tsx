'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as D from '@radix-ui/react-dialog';
import { Building2, CalendarCheck, Home, LogOut, Menu, Plus, Search, Target, UserRound, X } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { NAV, QUICK_ACTIONS, isActive } from './nav';
import { RealtimeRefresher } from './realtime-refresher';
import { NotificationsBell } from './notifications-bell';

export type ShellUser = { id: string; name: string; email: string | null; isAdmin: boolean; orgName: string };

export function AppShell({ user, brandColor, children }: { user: ShellUser; brandColor: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = React.useState(false);
  const [quick, setQuick] = React.useState(false);

  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawer(false);
    setQuick(false);
  }

  return (
    <div className="min-h-dvh" style={{ ['--brand' as string]: brandColor }}>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-nori-900 text-white lg:flex">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      <div className="lg:pl-64">
        <Topbar user={user} onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">{children}</main>
      </div>

      {/* Gaveta (mobile/tablet) */}
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-nori-950/50 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-72 flex-col bg-nori-900 text-white lg:hidden">
            <D.Title className="sr-only">Menu</D.Title>
            <D.Description className="sr-only">Navegação principal</D.Description>
            <D.Close className="absolute right-3 top-3 rounded-lg p-2 text-white/70 hover:bg-white/10" aria-label="Fechar menu">
              <X className="size-5" />
            </D.Close>
            <SidebarContent user={user} pathname={pathname} />
          </D.Content>
        </D.Portal>
      </D.Root>

      {/* Navegação inferior (mobile) */}
      <BottomNav pathname={pathname} onQuick={() => setQuick(true)} />

      {/* Ações rápidas "+" */}
      <D.Root open={quick} onOpenChange={setQuick}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-nori-950/50" />
          <D.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-4 pb-safe shadow-xl sm:inset-auto sm:bottom-24 sm:right-8 sm:w-80 sm:rounded-2xl">
            <D.Title className="px-1 pb-3 text-base font-semibold">Registrar</D.Title>
            <D.Description className="sr-only">Atalhos para criar registros</D.Description>
            <div className="grid grid-cols-2 gap-2 pb-2">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cn(
                    'flex min-h-20 flex-col justify-between rounded-xl p-3 text-sm font-semibold ring-1 ring-line',
                    'primary' in a && a.primary ? 'col-span-2 min-h-16 flex-row items-center justify-start gap-3 bg-brand text-white ring-0' : 'bg-rice',
                  )}
                >
                  <a.icon className={cn('size-5', 'primary' in a && a.primary ? 'text-white' : 'text-nori-700')} />
                  {a.label}
                </Link>
              ))}
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>

      {/* Botão flutuante desktop */}
      <button
        type="button"
        onClick={() => setQuick(true)}
        className="fixed bottom-6 right-8 z-30 hidden size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:bg-brand-hover lg:flex"
        aria-label="Registrar"
      >
        <Plus className="size-6" />
      </button>

      <RealtimeRefresher userId={user.id} isAdmin={user.isAdmin} />
    </div>
  );
}

function SidebarContent({ user, pathname }: { user: ShellUser; pathname: string }) {
  return (
    <>
      <div className="flex h-16 items-center gap-2.5 px-5">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
          <path d="M16 3 L29 26 Q29 29 26 29 L6 29 Q3 29 3 26 Z" fill="#f5f6f3" />
          <rect x="9" y="19" width="14" height="10" rx="1.5" fill="var(--color-brand)" />
        </svg>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{user.orgName}</p>
          <p className="text-xs text-white/50">CRM comercial</p>
        </div>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Principal">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || user.isAdmin);
          if (!items.length) return null;
          return (
            <div key={group.label ?? 'main'} className="mt-4 first:mt-1">
              {group.label && <p className="px-3 pb-1 text-xs font-medium text-white/40">{group.label}</p>}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white lg:py-2',
                          active && 'bg-white/10 font-medium text-white',
                        )}
                      >
                        <item.icon className={cn('size-[18px]', active ? 'text-white' : 'text-white/50')} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-white/50">{user.isAdmin ? 'Gestor' : 'Vendedor'}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sair">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function Topbar({ user, onMenu }: { user: ShellUser; onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-rice/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:px-6 lg:h-16 lg:px-8">
        <button type="button" onClick={onMenu} className="rounded-lg p-2 hover:bg-black/5 lg:hidden" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <span className="font-semibold lg:hidden">{user.orgName}</span>
        <form
          role="search"
          className="relative ml-auto hidden w-full max-w-md sm:block lg:ml-0"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length >= 2) router.push(`/busca?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente, CNPJ, comprador, telefone, pedido…"
            className="h-10 w-full rounded-lg bg-surface pl-9 pr-3 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Busca global"
          />
        </form>
        <div className="ml-auto flex items-center gap-1 sm:ml-2 lg:ml-auto">
          <Link href="/busca" className="rounded-lg p-2 hover:bg-black/5 sm:hidden" aria-label="Buscar">
            <Search className="size-5" />
          </Link>
          <NotificationsBell userId={user.id} />
          <Dropdown>
            <DropdownTrigger asChild>
              <button
                type="button"
                className="ml-1 flex size-9 items-center justify-center rounded-full bg-nori-900 text-xs font-semibold text-white"
                aria-label="Menu do usuário"
              >
                {initials(user.name)}
              </button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>
                {user.name}
                <span className="block font-normal">{user.email}</span>
              </DropdownLabel>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push('/configuracoes')}>
                <UserRound /> Meu perfil
              </DropdownItem>
              <DropdownItem onSelect={() => void signOut()}>
                <LogOut /> Sair
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ pathname, onQuick }: { pathname: string; onQuick: () => void }) {
  const items = [
    { href: '/', label: 'Início', icon: Home },
    { href: '/clientes', label: 'Clientes', icon: Building2 },
    { href: '/pipeline', label: 'Pipeline', icon: Target },
    { href: '/tarefas', label: 'Tarefas', icon: CalendarCheck },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur lg:hidden"
      aria-label="Navegação rápida"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  active ? 'text-ink' : 'text-muted',
                )}
              >
                <it.icon className={cn('size-[22px]', active && 'text-brand')} strokeWidth={active ? 2.4 : 2} />
                {it.label}
              </Link>
            </li>
          );
        })}
        <li className="flex items-center justify-center">
          <button
            type="button"
            onClick={onQuick}
            className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-md active:scale-95"
            aria-label="Registrar visita, cliente, pedido…"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
        </li>
      </ul>
    </nav>
  );
}

