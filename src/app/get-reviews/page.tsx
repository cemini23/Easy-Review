import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getCurrentOperator } from '@/app/actions/operators';
import { gbpReviewUrl } from '@/lib/review-link';
import ReviewLinkCard from '@/components/ReviewLinkCard';

export const dynamic = 'force-dynamic';

export default async function GetReviewsPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/onboarding');

  const placeId = operator.gbp_place_id?.trim();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Get Reviews</h1>
          <p className="text-sm text-slate-500">
            {operator.business_name} · a QR code + link to send customers to your Google review form
          </p>
        </header>

        {placeId ? (
          <ReviewLinkCard
            businessName={operator.business_name}
            url={gbpReviewUrl(placeId)}
            qrDataUrl={await QRCode.toDataURL(gbpReviewUrl(placeId), {
              width: 320,
              margin: 2,
            })}
          />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900">
            No Google <code>place_id</code> configured. Add one in onboarding to generate your
            review QR code and link. Look it up at{' '}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline"
            >
              Google&apos;s Place ID finder
            </a>
            .
          </div>
        )}
      </div>
    </main>
  );
}
