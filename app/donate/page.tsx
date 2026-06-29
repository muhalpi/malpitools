import type { Metadata } from "next";

import { DonationPage } from "@/components/donation-page";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: `Donasi - ${APP_NAME}`,
  description:
    "Halaman donasi resmi untuk mendukung Malpitools melalui transfer bank, e-wallet, atau QRIS.",
};

export default function Donate() {
  return <DonationPage />;
}
