import React from 'react';
import './index.css';
import { Composition } from 'remotion';
import { FoodyIntro } from './Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 9:16 portrait — perfect for mobile app store / social */}
      <Composition
        id="FoodyIntro"
        component={FoodyIntro}
        durationInFrames={90}
        fps={30}
        width={390}
        height={844}
      />
    </>
  );
};
