import TabBar from './components/TabBar';
import HomeMapClient from './components/HomeMapClient';
import StatusBar from './components/StatusBar';

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <div style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <StatusBar />
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
          <span style={{ color: '#0F6E56', fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em' }}>FoodMap</span>
        </div>
      </div>

      <HomeMapClient />

      <TabBar />
    </div>
  );
}
