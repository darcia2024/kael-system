'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { createCafeDemoAction } from '@/lib/actions-cafe-demo';

export default function DemoClient() {
  const [form, setForm] = useState({name:'', storeCode:'', email:'', password:'', pin:'', logoUrl:'', brandColor:'#26705a', phone:'', address:''});
  const [menus,setMenus] = useState([{name:'Kopi Susu',price:25000,cost:8000},{name:'Americano',price:20000,cost:5000},{name:'Croissant',price:28000,cost:11000}]);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [created,setCreated]=useState('');
  return <main className="min-h-screen bg-[#f7f6fc] p-4 text-[#232331] sm:p-8"><div className="mx-auto max-w-3xl">
    <Link href="/admin/control" aria-label="Kembali ke admin" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border bg-white"><ArrowLeft size={20}/></Link>
    <h1 className="mt-4 text-2xl font-bold">Demo Kafe</h1><p className="mt-2 text-sm">Akun uji berlaku 30 hari. Biaya bahan contoh adalah estimasi, bukan HPP terverifikasi milik kafe.</p>
    <form className="mt-6 space-y-6" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage('');try{const result=await createCafeDemoAction({...form,menus});if(result.error)setMessage(result.error);else setCreated(result.storeCode!);}catch{setMessage('Belum berhasil. Periksa daftar tenant sebelum mencoba lagi.');}finally{setBusy(false);}}}>
      <fieldset disabled={busy || !!created} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {([{key:'name',label:'Nama kafe'},{key:'storeCode',label:'Kode toko'},{key:'email',label:'Email owner demo'},{key:'password',label:'Password owner demo'},{key:'pin',label:'PIN kasir demo'},{key:'logoUrl',label:'URL logo (HTTPS, opsional)'},{key:'phone',label:'WhatsApp kafe (opsional)'},{key:'address',label:'Alamat (opsional)'}] as const).map(field=><label key={field.key} className="min-w-0 text-sm font-semibold">{field.label}<input required={!['logoUrl','phone','address'].includes(field.key)} type={field.key==='password'||field.key==='pin'?'password':field.key==='email'?'email':'text'} value={form[field.key]} onChange={e=>setForm({...form,[field.key]:field.key==='storeCode'?e.target.value.toUpperCase():e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-[#92929e] bg-white px-3"/></label>)}
        <label className="text-sm font-semibold">Warna kafe<input aria-label="Warna kafe" type="color" value={form.brandColor} onChange={e=>setForm({...form,brandColor:e.target.value})} className="mt-1 block h-11 w-20"/></label>
      </fieldset>
      <fieldset disabled={busy || !!created} className="min-w-0 space-y-3"><legend className="mb-3 font-bold">Menu dan biaya bahan per porsi</legend>
        {menus.map((menu,index)=><div key={index} className="grid grid-cols-[1fr_1fr_44px] gap-2 border-b pb-3 sm:grid-cols-[2fr_1fr_1fr_44px]">
          <label className="col-span-3 text-xs sm:col-span-1">Menu<input aria-label={`Nama menu ${index+1}`} value={menu.name} onChange={e=>setMenus(menus.map((m,i)=>i===index?{...m,name:e.target.value}:m))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"/></label>
          {(['price','cost'] as const).map(key=><label key={key} className="text-xs">{key==='price'?'Harga jual':'Biaya bahan'}<input type="number" min={key==='price'?1:0} step="1" value={menu[key]} onChange={e=>setMenus(menus.map((m,i)=>i===index?{...m,[key]:Number(e.target.value)}:m))} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-white px-2"/></label>)}
          <button type="button" title="Hapus menu" aria-label={`Hapus menu ${index+1}`} onClick={()=>setMenus(menus.filter((_,i)=>i!==index))} className="mt-5 flex h-11 w-11 items-center justify-center rounded-lg border bg-white"><Trash2 size={18}/></button>
        </div>)}
        <button type="button" onClick={()=>setMenus([...menus,{name:'',price:20000,cost:6000}])} className="inline-flex min-h-11 items-center gap-2"><Plus size={18}/>Tambah menu</button>
      </fieldset>
      <p role="status" className="text-sm text-red-700">{message}</p>
      {!created && <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-4 font-bold disabled:opacity-50"><Save size={18}/>{busy?'Membuat...':'Buat demo kafe'}</button>}
    </form>
    {created && <section className="mt-6 space-y-3 border-t pt-4"><h2 className="font-bold">Demo {form.name} siap</h2><p>Owner: {form.email}. Kasir: pilih toko {created} lalu Kasir Demo. Gunakan password dan PIN yang baru diisi.</p><div className="flex flex-wrap gap-4 underline"><Link href="/app/login">Login</Link><Link href={`/order/${created}/1`}>Order meja 1</Link><Link href={`/loyalty/register?toko=${created}`}>Daftar member</Link><Link href="/admin/cards">Kelola kartu NFC</Link></div></section>}
  </div></main>;
}
