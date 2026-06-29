import type { Metadata } from "next";

import { DonationPage } from "@/components/donation-page";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: `Donate - ${APP_NAME}`,
  description:
    "Official donation page for supporting Malpitools through bank transfer, e-wallet, or QRIS.",
};

export default function Donate() {
  return <DonationPage />;
}
