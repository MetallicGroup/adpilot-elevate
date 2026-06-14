const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-xs text-red-800">
        Plățile live nu sunt configurate. Finalizează activarea în panoul de plăți pentru a accepta plăți reale.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-200">
        Mediu de test — orice plată este simulată. Folosește cardul <span className="font-mono">4242 4242 4242 4242</span>.
      </div>
    );
  }
  return null;
}