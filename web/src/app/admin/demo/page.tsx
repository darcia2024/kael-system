import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DemoClient from './demo-client';
export default async function DemoPage() {
  const session = await getSession();
  if (!session) redirect('/admin');
  if (session.role !== 'kael_admin') redirect('/app');
  return <DemoClient />;
}
