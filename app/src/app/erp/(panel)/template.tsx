/**
 * Re-mounted on every move between screens, so each one eases in rather than
 * snapping. Skipped for anyone who has asked their device for less motion.
 */
export default function ErpTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">
      {children}
    </div>
  );
}
