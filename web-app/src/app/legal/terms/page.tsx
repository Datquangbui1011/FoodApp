import LegalPage from '../LegalPage';

export const metadata = { title: 'Terms of Service · Foody' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="June 2026"
      sections={[
        {
          heading: 'Using Foody',
          body: 'Foody helps you find the restaurants shown in food videos. You may use it for personal, non-commercial discovery. Don’t scrape the service, abuse the API, or attempt to disrupt it for other people.',
        },
        {
          heading: 'Your account',
          body: 'You’re responsible for keeping your sign-in details secure and for the activity on your account. Let us know promptly if you notice anything you didn’t do.',
        },
        {
          heading: 'Restaurant information',
          body: 'Locations, hours, ratings and links are pulled from third-party sources and AI inference, so they can be wrong or out of date. Always confirm details with the restaurant before you go.',
        },
        {
          heading: 'Content you submit',
          body: 'When you paste a video link you confirm you have the right to share it. We use it only to identify the restaurant and improve results.',
        },
        {
          heading: 'Changes',
          body: 'We may update these terms as the app evolves. If a change is significant we’ll surface it in the app before it takes effect.',
        },
      ]}
    />
  );
}
