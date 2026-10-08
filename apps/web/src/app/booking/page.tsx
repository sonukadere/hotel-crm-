import { redirect } from "next/navigation";
import { BookingClient } from "../../components/BookingClient";
import { parseStay } from "../../lib/stay";

export const dynamic = "force-dynamic";

interface BookingPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function BookingPage({ searchParams }: BookingPageProps) {
  const stay = parseStay(searchParams);

  const roomTypeId =
    typeof searchParams.roomTypeId === "string" && searchParams.roomTypeId
      ? searchParams.roomTypeId
      : null;

  if (!roomTypeId) {
    redirect("/rooms");
  }

  const ratePlanId =
    typeof searchParams.ratePlanId === "string" && searchParams.ratePlanId
      ? searchParams.ratePlanId
      : undefined;
  const mealPlan =
    typeof searchParams.mealPlan === "string" && searchParams.mealPlan
      ? searchParams.mealPlan
      : undefined;

  return (
    <BookingClient
      stay={stay}
      roomTypeId={roomTypeId}
      ratePlanId={ratePlanId}
      mealPlan={mealPlan ?? null}
    />
  );
}
