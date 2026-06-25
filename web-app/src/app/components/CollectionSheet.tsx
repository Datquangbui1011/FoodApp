'use client';

import { useEffect, useRef, useState } from 'react';
import { IconPlus, IconCheck, IconX, IconBookmark, IconCamera, IconCalendar } from '@tabler/icons-react';
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

interface Props {
  placeId: string;
  restaurantName: string;
  lat: number;
  lng: number;
  address?: string;
  cuisineType?: string;
  photoUrl?: string;
  rating?: number | null;
  onClose: () => void;
  onToast: (msg: string, ok?: boolean) => void;
}

export default function CollectionSheet({
  placeId, restaurantName, lat, lng, address, cuisineType, photoUrl, rating,
  onClose, onToast,
}: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/collections?placeId=${encodeURIComponent(placeId)}`)
      .then(r => r.json())
      .then((data: Collection[]) => { setCollections(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [placeId]);

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50);
  }, [creating]);

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

  async function toggleCollection(col: Collection) {
    if (busy) return;
    setBusy(col.id);
    try {
      if (col.hasCurrent) {
        await fetch(`/api/collections/${col.id}/items?placeId=${encodeURIComponent(placeId)}`, { method: 'DELETE' });
        setCollections(prev => prev.map(c => c.id === col.id ? { ...c, hasCurrent: false, count: c.count - 1 } : c));
        onToast(`Removed from ${col.name}`);
      } else {
        await fetch(`/api/collections/${col.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            place_id: placeId, restaurant_name: restaurantName,
            lat, lng, address: address ?? null, cuisine_type: cuisineType ?? null,
            photo_url: photoUrl ?? null, rating: rating ?? null,
          }),
        });
        setCollections(prev => prev.map(c => c.id === col.id ? { ...c, hasCurrent: true, count: c.count + 1 } : c));
        onToast(`Saved to ${col.name}`);
      }
    } catch { onToast('Something went wrong', false); }
    setBusy(null);
  }

  async function createCollection() {
    if (!newName.trim()) return;
    setBusy('new');
    try {
      let coverUrl: string | null = null;
      if (coverFile) coverUrl = await uploadCover(coverFile);

      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          emoji: '📍',
          cover_photo_url: coverUrl,
          target_date: newDate || null,
        }),
      });
      const col = await res.json() as Collection;
      setCollections(prev => [{ ...col, count: 0, hasCurrent: false }, ...prev]);
      setCreating(false);
      setNewName(''); setNewDate(''); setCoverPreview(null); setCoverFile(null);
      onToast(`Created "${col.name}"`);
    } catch { onToast('Failed to create list', false); }
    setBusy(null);
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={onClose} />

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: 'var(--cream)', borderRadius: '22px 22px 0 0',
        boxShadow: '0 -8px 32px rgba(60,22,14,0.18)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#D3D1C7' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconBookmark size={20} color="var(--tomato)" />
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>Save to list</p>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '3px 0 0' }}>{restaurantName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <IconX size={20} color="var(--ink-mute)" />
          </button>
        </div>

        <div style={{ height: 1, background: '#F0EFEC' }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>

          {/* Create new list */}
          {!creating ? (
            <button onClick={() => setCreating(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1.5px dashed #D3D1C7', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--tomato-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconPlus size={20} color="var(--tomato)" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tomato)' }}>New list</span>
            </button>
          ) : (
            <div style={{ background: 'white', borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>New list</p>

              {/* Cover photo picker */}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <button onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', height: 110, borderRadius: 12, border: '1.5px dashed #D3D1C7',
                  background: coverPreview ? 'transparent' : '#F7F6F3',
                  cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
                }}>
                {coverPreview ? (
                  <img src={coverPreview} alt="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <IconCamera size={24} color="#B0AFA9" />
                    <span style={{ fontSize: 12, color: '#B0AFA9', fontFamily: 'inherit' }}>Add cover photo</span>
                  </>
                )}
                {coverPreview && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 600, fontFamily: 'inherit' }}>Change photo</span>
                  </div>
                )}
              </button>

              {/* List name */}
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createCollection(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="List name…"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E8E7E3', fontSize: 15, fontFamily: 'inherit', outline: 'none', background: 'var(--cream)', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 10 }}
              />

              {/* Date picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E8E7E3', background: 'var(--cream)', marginBottom: 12 }}>
                <IconCalendar size={16} color="#B0AFA9" />
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  style={{ flex: 1, outline: 'none', background: 'transparent', border: 'none', fontSize: 14, fontFamily: 'inherit', color: newDate ? 'var(--ink)' : '#B0AFA9' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setCreating(false); setNewName(''); setNewDate(''); setCoverPreview(null); setCoverFile(null); }}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid #E8E7E3', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
                  Cancel
                </button>
                <button onClick={createCollection} disabled={!newName.trim() || busy === 'new'}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: newName.trim() ? 'var(--tomato)' : '#D3D1C7', cursor: newName.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'white' }}>
                  {busy === 'new' ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Collections list */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 14, background: '#F0EFEC' }} />)}
            </div>
          ) : collections.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, marginTop: 16 }}>
              No lists yet. Create your first one above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {collections.map(col => (
                <button key={col.id} onClick={() => toggleCollection(col)} disabled={busy === col.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 14, border: `1.5px solid ${col.hasCurrent ? 'var(--tomato)' : '#F0EFEC'}`,
                    background: col.hasCurrent ? '#FFF5F5' : 'white',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', opacity: busy === col.id ? 0.6 : 1,
                  }}>
                  {/* Cover or emoji */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {col.cover_photo_url
                      ? <img src={col.cover_photo_url} alt={col.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : col.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>{col.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '2px 0 0' }}>
                      {col.count} {col.count === 1 ? 'place' : 'places'}
                      {col.target_date ? ` · ${new Date(col.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                  {col.hasCurrent && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--tomato)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconCheck size={14} color="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </>
  );
}
