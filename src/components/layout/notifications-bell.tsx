'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Dropdown, DropdownContent, DropdownTrigger } from '@/components/ui/dropdown';
import { relativeTime } from '@/lib/format';
import type { NotificationRow } from '@/types/db';

export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const unread = items.filter((n) => !n.read_at).length;

  const load = React.useCallback(() => {
    void createClient()
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }: { data: unknown }) => setItems((data as NotificationRow[]) ?? []));
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    const first = setTimeout(load, 0);
    const ch = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () =>
        load(),
      )
      .subscribe();
    return () => {
      clearTimeout(first);
      void supabase.removeChannel(ch);
    };
  }, [load, userId]);

  const markAll = async () => {
    if (!unread) return;
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    load();
  };

  return (
    <Dropdown onOpenChange={(o) => o && setTimeout(markAll, 1500)}>
      <DropdownTrigger asChild>
        <button type="button" className="relative rounded-lg p-2 hover:bg-black/5" aria-label={`Notificações (${unread} não lidas)`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-80 p-0">
        <p className="border-b border-line px-4 py-3 text-sm font-semibold">Notificações</p>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação.</li>}
          {items.map((n) => (
            <li key={n.id} className="border-b border-line last:border-0">
              <Link href={n.link ?? '#'} className="block px-4 py-3 hover:bg-rice">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {!n.read_at && <span className="size-2 rounded-full bg-brand" aria-label="Não lida" />}
                  {n.title}
                </p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted">{relativeTime(n.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </DropdownContent>
    </Dropdown>
  );
}
