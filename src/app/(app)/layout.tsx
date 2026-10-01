import { AppShell } from '@/components/layout/app-shell';
import { requireSession } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell
      brandColor={session.organization.brand_color}
      user={{
        id: session.userId,
        name: session.profile.full_name || session.profile.email || 'Usuário',
        email: session.profile.email,
        isAdmin: session.isAdmin,
        orgName: session.organization.name,
      }}
    >
      {children}
    </AppShell>
  );
}
