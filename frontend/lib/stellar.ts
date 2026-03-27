/**
 * lib/stellar.ts
 * Stellar blockchain helpers for MarketPay.
 */

import { Horizon, Networks, Asset, Operation, TransactionBuilder, Transaction } from "@stellar/stellar-sdk";

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet") as "testnet" | "mainnet";
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

export const NETWORK_PASSPHRASE = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
export const server = new Horizon.Server(HORIZON_URL);

// USDC asset issued by Circle
export const USDC_ISSUER =
  NETWORK === "mainnet"
    ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
    : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const USDC = new Asset("USDC", USDC_ISSUER);

// ─── Account ─────────────────────────────────────────────────────────────────

export async function getXLMBalance(publicKey: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const xlm = account.balances.find((b) => b.asset_type === "native");
    return xlm ? xlm.balance : "0";
  } catch {
    throw new Error("Account not found or not funded.");
  }
}

export async function getUSDCBalance(publicKey: string): Promise<string | null> {
  try {
    const account = await server.loadAccount(publicKey);
    const usdc = account.balances.find(
      (b): b is Horizon.HorizonApi.BalanceLineAsset =>
        b.asset_type !== "native" &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === "USDC" &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === USDC_ISSUER
    );
    return usdc ? usdc.balance : null;
  } catch {
    return null;
  }
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * Build an unsigned payment transaction for XLM or USDC.
 */
export async function buildPaymentTransaction({
  fromPublicKey, toPublicKey, amount, memo, asset = "XLM",
}: {
  fromPublicKey: string;
  toPublicKey: string;
  amount: string;
  memo?: string;
  asset?: "XLM" | "USDC";
}) {
  const sourceAccount = await server.loadAccount(fromPublicKey);

  // Check recipient trustline for USDC
  if (asset === "USDC") {
    const recipient = await server.loadAccount(toPublicKey).catch(() => null);
    if (!recipient) throw new Error("Recipient account not found on Stellar network.");
    const hasTrustline = recipient.balances.some(
      (b): b is Horizon.HorizonApi.BalanceLineAsset =>
        b.asset_type !== "native" &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === "USDC" &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === USDC_ISSUER
    );
    if (!hasTrustline) {
      throw new Error("Recipient has no USDC trustline. They must add USDC to their wallet first.");
    }
  }

  const builder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({
      destination: toPublicKey,
      asset: asset === "USDC" ? USDC : Asset.native(),
      amount,
    }))
    .setTimeout(60);

  if (memo) {
    const { Memo } = await import("@stellar/stellar-sdk");
    builder.addMemo(Memo.text(memo.slice(0, 28)));
  }

  return builder.build();
}

export async function submitTransaction(signedXDR: string) {
  const tx = new Transaction(signedXDR, NETWORK_PASSPHRASE);
  try {
    return await server.submitTransaction(tx);
  } catch (err: unknown) {
    const e = err as { response?: { data?: { extras?: { result_codes?: unknown } } } };
    if (e?.response?.data?.extras?.result_codes) {
      throw new Error(`Transaction failed: ${JSON.stringify(e.response.data.extras.result_codes)}`);
    }
    throw err;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

export function explorerUrl(hash: string): string {
  const net = NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}

export function accountUrl(address: string): string {
  const net = NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/account/${address}`;
}
