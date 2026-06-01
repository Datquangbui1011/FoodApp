import HomeMapClient from './components/HomeMapClient';
import TabBar from './components/TabBar';

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <HomeMapClient />
      <TabBar />
    </div>
  );
}
