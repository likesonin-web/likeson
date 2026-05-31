/**
 * app/care-assistant/rides/[rideId]/tracking/page.jsx
 */

import CareRideLiveTrackingPage from '@/components/rides/tracking/CareRideLiveTrackingPage';

export const metadata = {
  title:       'Live Tracking | Likeson Healthcare',
  description: 'Real-time ride tracking for care rides',
};

export const dynamic = 'force-dynamic';

export default function TrackingPage({ params }) {
  // Pass the dynamic rideId from the URL straight to your client component
  return <CareRideLiveTrackingPage rideId={params.rideId} />;
}