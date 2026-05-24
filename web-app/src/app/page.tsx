import TabBar from './components/TabBar';
import HomeMapClient from './components/HomeMapClient';

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div
        className="flex justify-between items-center px-4 pt-3 pb-1.5 flex-shrink-0"
        style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)', zIndex: 10 }}
      >
        <span style={{ color: '#888780', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#0F6E56', fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em' }}>FoodMap</span>
        <span style={{ color: '#888780', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      <HomeMapClient />

      <TabBar />
    </div>
  );
}
