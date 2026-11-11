"use client";

import { useSession } from "./SessionProvider";

export default function DemoBanner() {
  const { demo } = useSession();
  if (!demo) return null;

  return (
    <div className="demo-banner">
      <div className="container">
        <strong>Mode démonstration</strong> — données fictives. Aucun gain réel
        n'est généré ni versé.
      </div>
    </div>
  );
}
