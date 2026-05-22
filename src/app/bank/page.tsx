"use client";

// /bank reuses the investor financial overview verbatim. The bank-only
// distinction is enforced at the layout level (header strip + no admin
// chrome) and via the `bank` viewMode override in BankLayout.
import InvestorPage from "../investor/page";

export default function BankPage() {
  return <InvestorPage />;
}
