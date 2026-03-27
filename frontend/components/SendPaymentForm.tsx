/**
 * components/SendPaymentForm.tsx
 * Send XLM or USDC payment from the connected wallet.
 */
import { useState } from "react";
import { buildPaymentTransaction, submitTransaction, isValidStellarAddress, explorerUrl } from "@/lib/stellar";
import { signTransactionWithWallet } from "@/lib/wallet";
import clsx from "clsx";

type Asset = "XLM" | "USDC";

interface SendPaymentFormProps {
  fromPublicKey: string;
}

export default function SendPaymentForm({ fromPublicKey }: SendPaymentFormProps) {
  const [asset, setAsset]         = useState<Asset>("XLM");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount]       = useState("");
  const [memo, setMemo]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash]         = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const recipientValid = isValidStellarAddress(recipient);

  const handleSend = async () => {
    setError(null);
    setTxHash(null);

    if (!recipientValid) { setError("Invalid Stellar address."); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount greater than 0."); return; }

    setSubmitting(true);
    try {
      const tx = await buildPaymentTransaction({
        fromPublicKey,
        toPublicKey: recipient.trim(),
        amount: parsed.toFixed(7),
        memo: memo.trim() || undefined,
        asset,
      });

      const { signedXDR, error: signError } = await signTransactionWithWallet(tx.toXDR());
      if (signError || !signedXDR) throw new Error(signError || "Signing cancelled.");

      const result = await submitTransaction(signedXDR);
      setTxHash((result as any).hash ?? null);
      setRecipient("");
      setAmount("");
      setMemo("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card border-market-500/20">
      <h3 className="font-display text-base font-semibold text-amber-100 mb-4">Send Payment</h3>

      {/* Asset selector */}
      <div className="flex gap-2 mb-4">
        {(["XLM", "USDC"] as Asset[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAsset(a)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
              asset === a
                ? "bg-market-500/15 text-market-300 border-market-500/30"
                : "text-amber-700 border-market-500/10 hover:border-market-500/25"
            )}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Recipient */}
      <label className="label block mb-1">Recipient address</label>
      <input
        type="text"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value.trim())}
        placeholder="G…"
        className={clsx(
          "w-full bg-ink-800 border rounded-xl px-4 py-2.5 text-sm text-amber-100 placeholder-amber-900 focus:outline-none mb-1",
          recipient && !recipientValid
            ? "border-red-500/40 focus:border-red-500/60"
            : "border-market-500/15 focus:border-market-500/40"
        )}
      />
      {recipient && !recipientValid && (
        <p className="text-xs text-red-400 mb-3">Not a valid Stellar address</p>
      )}

      {/* Amount */}
      <label className="label block mt-3 mb-1">Amount ({asset})</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.0000000"
        min="0"
        step="0.0000001"
        className="w-full bg-ink-800 border border-market-500/15 rounded-xl px-4 py-2.5 text-sm text-amber-100 placeholder-amber-900 focus:outline-none focus:border-market-500/40 mb-3"
      />

      {/* Memo */}
      <label className="label block mb-1">Memo <span className="text-amber-900 font-normal">(optional)</span></label>
      <input
        type="text"
        value={memo}
        onChange={(e) => setMemo(e.target.value.slice(0, 28))}
        placeholder="Up to 28 characters"
        className="w-full bg-ink-800 border border-market-500/15 rounded-xl px-4 py-2.5 text-sm text-amber-100 placeholder-amber-900 focus:outline-none focus:border-market-500/40 mb-4"
      />

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {txHash && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          ✅ Sent!{" "}
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-300">
            View on Stellar Expert ↗
          </a>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={submitting || !recipient || !amount}
        className="btn-primary text-sm py-2.5 px-6 w-full disabled:opacity-50"
      >
        {submitting ? "Sending…" : `Send ${asset}`}
      </button>
    </div>
  );
}
