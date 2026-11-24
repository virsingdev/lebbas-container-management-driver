'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type Row, uid } from '@/lib/api';
import { cached } from '@/lib/cached';
import { getFix } from '@/lib/geo';
import { enqueue } from '@/lib/sync';
import { Badge, Btn, Card, Empty, Skeleton, inputCls } from '@/components/ui';

const CATS = [['container_damage', 'Container damaged'], ['access_problem', 'Container inaccessible'], ['vehicle_issue', 'Vehicle problem'], ['safety', 'Safety'], ['operational_issue', 'Operational issue'], ['other', 'Other']];
const SEV = ['low', 'medium', 'high', 'critical'];

export default function Incidents() {
  const list = useQuery({ queryKey: ['incidents'], queryFn: () => cached<Row[]>('incidents', () => api('/driver/incidents?page_size=20').then((d) => d.items)) });
  const [f, setF] = useState({ title: '', description: '', category: 'container_damage', severity: 'medium', location_description: '' });
  const [busy, setBusy] = useState(false);
  const ok = f.title.trim() && f.description.trim();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!ok || busy) return; setBusy(true);
    try {
      const fix = await getFix(5000); const id = uid();
      await enqueue({ id, type: 'incident_create', label: `Incident: ${f.title.trim()}`, payload: { title: f.title.trim(), description: f.description.trim(), category: f.category, severity: f.severity, occurred_at: new Date().toISOString(), ...(f.location_description.trim() ? { location_description: f.location_description.trim() } : {}), ...(fix ? { latitude: fix.latitude, longitude: fix.longitude } : {}) } });
      toast.success('Saved on this phone. Syncing…'); setF({ ...f, title: '', description: '', location_description: '' });
      setTimeout(() => list.refetch(), 2500);
    } finally { setBusy(false); }
  }
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Report an incident</h1>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium">What happened? *
          <div className="mt-1 grid grid-cols-2 gap-2">{CATS.map(([v, l]) => <button type="button" key={v} onClick={() => setF({ ...f, category: v })} aria-pressed={f.category === v} className={`min-h-[52px] rounded-xl border-2 px-2 text-sm font-semibold ${f.category === v ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E]' : 'border-slate-200'}`}>{l}</button>)}</div></label>
        <label className="block text-sm font-medium">Title *<input className={inputCls} value={f.title} maxLength={255} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="block text-sm font-medium">Details *<textarea className={inputCls} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="block text-sm font-medium">How serious?<select className={inputCls} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{SEV.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="block text-sm font-medium">Where?<input className={inputCls} value={f.location_description} onChange={(e) => setF({ ...f, location_description: e.target.value })} /></label>
        <Btn type="submit" disabled={!ok || busy}>{busy ? 'Saving…' : 'Submit incident'}</Btn>
        <p className="text-xs text-slate-500">Photos are not available yet: the server has no photo upload endpoint.</p>
      </form>
      <h2 className="font-semibold">My incidents</h2>
      {list.isLoading ? <Skeleton rows={2} /> : !list.data?.data.length ? <Empty>No incidents reported.</Empty> : list.data.data.map((i) => (
        <Card key={i.id} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{i.title}</p><p className="text-xs text-slate-500">{format(new Date(i.reported_at), 'd MMM HH:mm')} · {i.category.replace(/_/g, ' ')}</p></div><Badge>{i.status}</Badge></Card>))}
    </>
  );
}
