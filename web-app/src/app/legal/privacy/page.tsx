import LegalPage from '../LegalPage';

export const metadata = { title: 'Privacy Policy · Foody' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="June 2026"
      sections={[
        {
          heading: 'What we collect',
          body: 'Your account email, the restaurants you save, and the video links you analyze. With your permission we use your device location to show places near you — it stays on your device unless you search.',
        },
        {
          heading: 'How we use it',
          body: 'To identify restaurants from videos, show them on the map, keep your saved list in sync across devices, and make results more accurate over time.',
        },
        {
          heading: 'Who we share it with',
          body: 'We send video links and place queries to mapping and AI providers purely to return your results. We don’t sell your personal data to anyone.',
        },
        {
          heading: 'Your control',
          body: 'You can remove saved places at any time and delete your account to erase your data. Location access can be revoked in your device settings whenever you like.',
        },
        {
          heading: 'Contact',
          body: 'Questions about your data? Email privacy@foody.app and we’ll get back to you.',
        },
      ]}
    />
  );
}
