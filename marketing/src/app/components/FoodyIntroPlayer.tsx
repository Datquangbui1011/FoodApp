'use client';

import { Player } from '@remotion/player';
import { FoodyIntro } from './FoodyIntroComposition';

export default function FoodyIntroPlayer() {
  return (
    <Player
      component={FoodyIntro}
      durationInFrames={90}
      fps={30}
      compositionWidth={390}
      compositionHeight={844}
      style={{
        width: 220,
        height: 476,
        borderRadius: 32,
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}
      loop
      autoPlay
      clickToPlay={false}
    />
  );
}
