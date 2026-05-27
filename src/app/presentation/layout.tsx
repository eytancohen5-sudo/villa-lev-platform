import { Suspense } from "react";

/**
 * /presentation layout — public, no AuthGate, full viewport height.
 *
 * Fills the screen so the PDF iframe can stretch to 100% of the remaining
 * space below the viewer toolbar.
 */
export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Suspense>{children}</Suspense>
    </div>
  );
}
