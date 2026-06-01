import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const staticFile = (name: string) => `/${name}`;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [0, 45, 90], [1, 1.15, 1], clamp);
  return (
    <AbsoluteFill style={{ background: '#1A0808' }}>
      <div style={{
        position: 'absolute', top: '35%', left: '50%',
        transform: `translate(-50%, -50%) scale(${pulse})`,
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(224,48,48,0.30) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, left: '50%',
        transform: 'translateX(-50%)',
        width: 500, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,166,35,0.14) 0%, transparent 70%)',
      }} />
    </AbsoluteFill>
  );
};

const FloatingEmoji: React.FC<{
  emoji: string; startFrame: number; x: number; delay: number;
}> = ({ emoji, startFrame, x, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame - delay;
  if (local < 0) return null;
  const opacity = interpolate(local, [0, 8, 50, 70], [0, 1, 1, 0], clamp);
  const y       = interpolate(local, [0, 80], [40, -220], { ...clamp, easing: Easing.out(Easing.ease) });
  const rotate  = interpolate(local, [0, 80], [-15, 20], clamp);
  const sc      = spring({ fps, frame: local, config: { damping: 12, stiffness: 120 } });
  return (
    <div style={{
      position: 'absolute', bottom: '18%', left: x,
      transform: `translateY(${y}px) rotate(${rotate}deg) scale(${sc})`,
      fontSize: 40, opacity,
    }}>{emoji}</div>
  );
};

const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sc     = spring({ fps, frame, config: { damping: 10, stiffness: 120, mass: 0.8 } });
  const spin   = interpolate(frame, [0, 18, 28], [0, -22, 0], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  const bounce = interpolate(frame, [0, 10, 18, 24, 30], [0, -36, 10, -14, 0], { ...clamp, easing: Easing.out(Easing.ease) });
  return (
    <div style={{
      transform: `scale(${sc}) translateY(${bounce}px) rotate(${spin}deg)`,
      width: 160, height: 160, borderRadius: 42, overflow: 'hidden',
      boxShadow: '0 28px 70px rgba(0,0,0,0.65), 0 0 0 5px rgba(224,48,48,0.35)',
    }}>
      <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sc = spring({ fps, frame, config: { damping: 12, stiffness: 160 } });
  const op = interpolate(frame, [0, 6], [0, 1], clamp);
  return (
    <div style={{ transform: `scale(${sc})`, opacity: op, textAlign: 'center' }}>
      <div style={{
        fontSize: 80, fontWeight: 900, color: 'white',
        letterSpacing: '-4px', lineHeight: 1,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textShadow: '0 6px 28px rgba(224,48,48,0.55)',
      }}>
        Foody
      </div>
    </div>
  );
};

const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.ease) });
  const y  = interpolate(frame, [0, 16], [20, 0], { ...clamp, easing: Easing.out(Easing.ease) });
  return (
    <div style={{ opacity: op, transform: `translateY(${y}px)`, textAlign: 'center' }}>
      <div style={{
        fontSize: 24, color: 'rgba(255,255,255,0.50)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        letterSpacing: '-0.3px',
      }}>
        Discover restaurants from food videos
      </div>
    </div>
  );
};

const Dots: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[0, 1, 2].map(i => {
        const op = interpolate(frame, [i * 7, i * 7 + 9], [0.3, 1], clamp);
        const sc = interpolate(frame, [i * 7, i * 7 + 9, i * 7 + 18], [0.7, 1.4, 1], clamp);
        return (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#E03030', opacity: op,
            transform: `scale(${sc})`,
          }} />
        );
      })}
    </div>
  );
};

const EMOJIS = [
  { emoji: '🍜', x: 50,  delay: 0  },
  { emoji: '☕', x: 170, delay: 7  },
  { emoji: '🍕', x: 300, delay: 3  },
  { emoji: '🍣', x: 420, delay: 10 },
  { emoji: '🌮', x: 530, delay: 5  },
  { emoji: '🍔', x: 640, delay: 13 },
];

export const FoodyIntro: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />

      {EMOJIS.map((e, i) => (
        <FloatingEmoji key={i} emoji={e.emoji} startFrame={28} x={e.x} delay={e.delay} />
      ))}

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Sequence layout="none">
          <Logo />
        </Sequence>
        <Sequence from={20} layout="none">
          <Title />
        </Sequence>
        <Sequence from={32} layout="none">
          <Tagline />
        </Sequence>
        <Sequence from={58} layout="none">
          <Dots />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
