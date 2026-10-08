import { ConfirmationClient } from "../../../components/ConfirmationClient";

export const dynamic = "force-dynamic";

interface ConfirmationPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const bookingNumber =
    typeof searchParams.bookingNumber === "string" ? searchParams.bookingNumber : "";

  return <ConfirmationClient bookingNumber={bookingNumber} />;
}
