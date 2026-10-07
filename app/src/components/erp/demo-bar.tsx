/**
 * Marks the training copy of the back office on every screen, so nobody
 * mistakes it for the real one. Shown only where DEMO_MODE is set.
 */
export function DemoBar() {
  return (
    <p className="bg-orange-500 px-4 py-2 text-center text-sm font-semibold text-white print:hidden">
      DEMO COPY for training. Nothing here is real, and nothing is sent to anyone.
    </p>
  );
}
