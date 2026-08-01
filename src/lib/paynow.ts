import { Paynow } from "paynow";

export type MobileMethod = "ecocash" | "onemoney";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getPaynowClient() {
  const id = requireEnv("PAYNOW_INTEGRATION_ID");
  const key = requireEnv("PAYNOW_INTEGRATION_KEY");
  const paynow = new Paynow(id, key);
  paynow.resultUrl = process.env.PAYNOW_RESULT_URL ?? "";
  paynow.returnUrl = process.env.PAYNOW_RETURN_URL ?? "";
  return paynow;
}

export function isPaynowConfigured(): boolean {
  return Boolean(
    process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY,
  );
}

export async function initiateWebPayment(params: {
  reference: string;
  email?: string;
  description: string;
  amount: number;
  returnUrl?: string;
}) {
  const paynow = getPaynowClient();
  if (params.returnUrl) {
    paynow.returnUrl = params.returnUrl;
  }

  const payment = params.email
    ? paynow.createPayment(params.reference, params.email)
    : paynow.createPayment(params.reference);

  payment.add(params.description, Number(params.amount.toFixed(2)));

  const response = await paynow.send(payment);
  return {
    success: Boolean(response.success),
    redirectUrl: response.redirectUrl as string | undefined,
    pollUrl: response.pollUrl as string | undefined,
    error: (response as { error?: string }).error,
    raw: response,
  };
}

export async function initiateMobilePayment(params: {
  reference: string;
  email: string;
  description: string;
  amount: number;
  phone: string;
  method: MobileMethod;
}) {
  const paynow = getPaynowClient();
  const payment = paynow.createPayment(params.reference, params.email);
  payment.add(params.description, Number(params.amount.toFixed(2)));

  const response = await paynow.sendMobile(payment, params.phone, params.method);
  return {
    success: Boolean(response.success),
    pollUrl: response.pollUrl as string | undefined,
    instructions: (response as { instructions?: string }).instructions,
    error: (response as { error?: string }).error,
    raw: response,
  };
}

export async function pollPayment(pollUrl: string) {
  const paynow = getPaynowClient();
  const status = await paynow.pollTransaction(pollUrl);
  const paid =
    typeof status.paid === "function" ? Boolean(status.paid()) : Boolean(status.paid);

  return {
    paid,
    status: String((status as { status?: string }).status ?? ""),
    amount: (status as { amount?: string | number }).amount,
    reference: (status as { reference?: string }).reference,
    paynowReference: (status as { paynowReference?: string }).paynowReference,
    raw: status,
  };
}

/** Paynow hash: concatenate values + integration key, SHA512 uppercase hex */
export async function verifyPaynowHash(
  payload: Record<string, string>,
  receivedHash: string,
): Promise<boolean> {
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!key) return false;

  const ordered = Object.keys(payload)
    .filter((k) => k.toLowerCase() !== "hash")
    .sort()
    .map((k) => payload[k])
    .join("")
    .concat(key);

  const { createHash } = await import("crypto");
  const digest = createHash("sha512").update(ordered).digest("hex").toUpperCase();
  return digest === receivedHash.toUpperCase();
}
