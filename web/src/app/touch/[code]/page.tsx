import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, Menu, MessageCircle, Star, UsersRound, ExternalLink } from 'lucide-react';
import { BusinessMark } from '@/components/business-mark';
import { db } from '@/lib/db';

const ICONS: Record<string, typeof Star> = {review:Star,whatsapp:MessageCircle,menu:Menu,member:UsersRound,location:MapPin,booking:CalendarDays,custom:ExternalLink};
export default async function SmartTouchPage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params;
  const profile=await db.getSmartTouchByCode(code);
  if(!profile)notFound();
  const buttons=profile.buttons.filter(button=>button.is_enabled);
  return <main className="min-h-screen bg-[#f7f6fc] px-4 py-8 text-[#232331]">
    <section className="mx-auto max-w-md border-t-4 pt-6" style={{borderColor:profile.brand_color}}>
      <header className="mb-6 text-center">
        <div className="flex justify-center"><BusinessMark name={profile.business_name} logoUrl={profile.logo_url} brandColor={profile.brand_color} size="lg" className="h-16 w-16 rounded-full border-2 border-emerald-400/40 shadow-sm" /></div>
        <h1 className="mt-4 break-words text-2xl font-bold">{profile.title}</h1>
        <p className="mt-2 break-words text-sm text-[#66667a]">{profile.subtitle || profile.business_name}</p>
      </header>
      <div className="space-y-3">{buttons.map(button=>{const Icon=ICONS[button.action_key]??ExternalLink;return <a key={button.action_key} href={button.target_url} className="flex min-h-12 items-center gap-3 rounded-lg border-2 border-[#232331] bg-white px-4 py-3 font-semibold hover:bg-[#d9ff57] focus-visible:outline-2 focus-visible:outline-offset-4">
        <Icon className="shrink-0" size={18} style={{color:profile.brand_color}}/><span className="min-w-0 flex-1 break-words">{button.label}</span><ExternalLink className="shrink-0" size={16}/>
      </a>;})}</div>
      {!buttons.length && <p className="py-6 text-center text-sm">Layanan sedang disiapkan oleh pemilik usaha.</p>}
      <p className="mt-8 text-center text-xs text-[#66667a]">Powered by KAEL Smart Touch</p>
    </section>
  </main>;
}
