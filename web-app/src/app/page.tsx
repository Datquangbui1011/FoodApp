import TabBar from './components/TabBar';
import HomeClient from './components/HomeClient';

const recentSearches = [
  { id: 1, name: 'Pho Hoa Dallas', time: '2 hours ago', confidence: 94, color: '#C5E8D8' },
  { id: 2, name: 'Ramen Tatsu-ya', time: 'Yesterday', confidence: 88, color: '#F5D9A0' },
  { id: 3, name: 'Uchi Austin', time: '3 days ago', confidence: 91, color: '#D5D2F5' },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1.5" style={{ background: '#0F6E56' }}>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      {/* Search header */}
      <div className="px-3.5 pt-2 pb-4" style={{ background: '#0F6E56' }}>
        <h1 style={{ color: 'white', fontSize: 16, fontWeight: 600, marginBottom: 2 }}>FoodMap</h1>
        <span style={{ color: '#9FE1CB', fontSize: 9, display: 'block', marginBottom: 10 }}>
          Paste a food video, find the restaurant
        </span>
        <HomeClient />
      </div>

      {/* Content */}
      <div className="flex-1 px-3.5 py-3">
        <p style={{ fontSize: 9, fontWeight: 500, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Recent searches
        </p>
        {recentSearches.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 py-1.5 border-b"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <div className="w-8 h-8 rounded-md flex-shrink-0" style={{ background: item.color }} />
            <div className="flex-1">
              <p style={{ fontSize: 9, fontWeight: 500, color: '#2C2C2A', marginBottom: 1 }}>{item.name}</p>
              <span style={{ fontSize: 8, color: '#888780' }}>{item.time} · {item.confidence}% confident</span>
            </div>
          </div>
        ))}
      </div>

      <TabBar />
    </div>
  );
}
