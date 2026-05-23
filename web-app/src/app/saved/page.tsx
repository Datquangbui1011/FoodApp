import TabBar from '../components/TabBar';

const tabs = ['All', 'Collections', 'Notes'];

const savedItems = [
  { id: 1, name: 'Pho Hoa Dallas', sub: 'Vietnamese · ★ 4.2', color: '#C5E8D8' },
  { id: 2, name: 'Ramen Tatsu-ya', sub: 'Japanese · ★ 4.7', color: '#D5D2F5' },
  { id: 3, name: 'Uchi Austin', sub: 'Japanese · ★ 4.8', color: '#F5D9A0' },
  { id: 4, name: 'Laos in Town', sub: 'Laotian · ★ 4.5', color: '#F5C4B3' },
];

export default function Saved() {
  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1.5">
        <span style={{ color: '#888780', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#888780', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      {/* Header */}
      <div className="px-3.5 pt-2.5 pb-2 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#2C2C2A' }}>Saved</h2>
        <div className="flex gap-1.5">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className="px-2.5 py-0.5 rounded-full"
              style={{
                fontSize: 8,
                fontWeight: 500,
                border: '1px solid rgba(0,0,0,0.1)',
                background: i === 0 ? '#0F6E56' : 'white',
                color: i === 0 ? 'white' : '#5F5E5A',
                borderColor: i === 0 ? '#0F6E56' : 'rgba(0,0,0,0.1)',
              }}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="grid grid-cols-2 gap-2">
          {savedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(0,0,0,0.1)', background: 'white' }}
            >
              <div style={{ height: 58, background: item.color }} />
              <div className="px-2 py-1.5">
                <p style={{ fontSize: 9, fontWeight: 500, color: '#2C2C2A', marginBottom: 1 }}>
                  {item.name}
                </p>
                <span style={{ fontSize: 7, color: '#888780' }}>{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TabBar />
    </div>
  );
}
