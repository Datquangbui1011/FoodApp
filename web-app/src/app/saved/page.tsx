'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconBookmark, IconPlus, IconCamera, IconCalendar } from '@tabler/icons-react';
import StatusBar from '../components/StatusBar';
import { createClient } from '@/lib/supabase/client';

interface Collection {
  id: string;
  name: string;
  emoji: string;
  cover_photo_url: string | null;
  target_date: string | null;
  count: number;
  hasCurrent: boolean;
}

const BG_COLORS = ['#F2DACE', '#EFE2C8', '#EAD6CB', '#F3DCCF', '#EAD4D4', '#D4E8EA'];

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/collections')
      .then(r => r.json())
      .then((data: Collection[]) => { setCollections(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = ev => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadCover(file: File): Promise<string | null> {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('collection-covers').upload(path, file, { upsert: true });
      if (error) return null;
      const { data } = supabase.storage.from('collection-covers').getPublicUrl(path);
      return data.publicUrl;
    } catch { return null; }
  }

  async function createCollection() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      let coverUrl: string | null = null;
      if (coverFile) coverUrl = await uploadCover(coverFile);
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), emoji: '📍', cover_photo_url: coverUrl, target_date: newDate || null }),
      });
      const col = await res.json() as Collection;
      setCollections(prev => [{ ...col, count: 0, hasCurrent: false }, ...prev]);
      setCreating(false);
      setNewName(''); setNewDate(''); setCoverPreview(null); setCoverFile(null);
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)' }}>
      <header style={{ flexShrink: 0 }}>
        <StatusBar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 14px' }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>Collections</h1>
            {!loading && collections.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0 0' }}>
                {collections.length} {collections.length === 1 ? 'list' : 'lists'}
              </p>
            )}
          </div>
          <button
            onClick={() => setCreating(true)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--tomato)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(194,55,31,0.35)' }}>
            <IconPlus size={20} color="white" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: '4px 14px', paddingBottom: 'calc(16px + 64px)' }}>

        {/* Create list form */}
        {creating && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>New list</p>

            {/* Cover photo */}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()}
              style={{ width: '100%', height: 120, borderRadius: 12, border: '1.5px dashed #D3D1C7', background: coverPreview ? 'transparent' : '#F7F6F3', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 600, fontFamily: 'inherit' }}>Change photo</span>
                  </div>
                </>
              ) : (
                <>
                  <IconCamera size={24} color="#B0AFA9" />
                  <span style={{ fontSize: 12, color: '#B0AFA9', fontFamily: 'inherit' }}>Add cover photo</span>
                </>
              )}
            </button>

            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createCollection(); if (e.key === 'Escape') setCreating(false); }}
              placeholder="List name…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E8E7E3', fontSize: 15, fontFamily: 'inherit', outline: 'none', background: 'var(--cream)', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 10 }}
            />

            {/* Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E8E7E3', background: 'var(--cream)', marginBottom: 12 }}>
              <IconCalendar size={16} color="#B0AFA9" />
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{ flex: 1, outline: 'none', background: 'transparent', border: 'none', fontSize: 14, fontFamily: 'inherit', color: newDate ? 'var(--ink)' : '#B0AFA9' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setCreating(false); setNewName(''); setNewDate(''); setCoverPreview(null); setCoverFile(null); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid #E8E7E3', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
                Cancel
              </button>
              <button onClick={createCollection} disabled={!newName.trim() || busy}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: newName.trim() ? 'var(--tomato)' : '#D3D1C7', cursor: newName.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'white' }}>
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ borderRadius: 'var(--radius)', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow-warm-sm)' }}>
                <div style={{ height: 100, background: '#F0EFEC' }} />
                <div style={{ padding: '10px 11px 12px' }}>
                  <div style={{ height: 9, borderRadius: 5, background: '#F0EFEC', marginBottom: 7, width: '75%' }} />
                  <div style={{ height: 7, borderRadius: 5, background: '#F0EFEC', width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 90, gap: 14 }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--tomato-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBookmark size={34} color="var(--tomato)" />
            </div>
            <p className="font-display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>No lists yet</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6, maxWidth: 240 }}>
              Tap the bookmark icon on any restaurant to save it to a list.
            </p>
            <button onClick={() => setCreating(true)}
              style={{ marginTop: 4, padding: '10px 24px', borderRadius: 99, background: 'var(--tomato)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'white', boxShadow: '0 4px 14px rgba(194,55,31,0.35)' }}>
              Create your first list
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {collections.map((col, i) => (
              <Link key={col.id} href={`/saved/${col.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow-warm-sm)' }}>
                  {/* Cover */}
                  <div style={{ height: 100, background: BG_COLORS[i % BG_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, position: 'relative', overflow: 'hidden' }}>
                    {col.cover_photo_url
                      ? <img src={col.cover_photo_url} alt={col.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : col.emoji}
                  </div>
                  <div style={{ padding: '10px 11px 12px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 3px', lineHeight: 1.2 }}>{col.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0 }}>
                      {col.count} {col.count === 1 ? 'place' : 'places'}
                      {col.target_date ? ` · ${new Date(col.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
