import { getSlippingRegulars } from "@/app/actions/guests";
import GuestList from "@/components/GuestList";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const slippingRegulars = await getSlippingRegulars();

  return (
    <div className="pb-20">
      <GuestList slippingRegulars={slippingRegulars} />
    </div>
  );
}
