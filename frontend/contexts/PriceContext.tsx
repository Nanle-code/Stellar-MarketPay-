/**
 * contexts/PriceContext.tsx
 * Fetches XLM/USD price once on mount and shares it across the app.
 * Fails silently — components receive null if price is unavailable.
 */
import React, { createContext, useContext, useEffect, useState } from "react";

interface PriceContextValue {
  xlmPriceUsd: number | null;
}

const PriceContext = createContext<PriceContextValue>({ xlmPriceUsd: null });

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [xlmPriceUsd, setXlmPriceUsd] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd")
      .then((res) => res.json())
      .then((data) => {
        const price = data?.stellar?.usd;
        if (typeof price === "number") setXlmPriceUsd(price);
      })
      .catch(() => {
        // Fail silently — USD equivalent simply won't show
      });
  }, []);

  return (
    <PriceContext.Provider value={{ xlmPriceUsd }}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePriceContext() {
  return useContext(PriceContext);
}
