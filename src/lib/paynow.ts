import { Paynow } from "paynow";
import { getSetting } from "@/lib/settings";

export type MobileMethod = "ecocash" | "onemoney";

export type PaynowConfig = {
  integrationId: string;
  integrationKey: string;
  resultUrl: string;
  returnUrl: string;
  enabled: boolean;
  /** Where each field was resolved from */
  sources: {
    integrationId: "database" | "env" | "missing";
    integrationKey: "database" | "env" | "missing";
    resultUrl: "database" | "env" | "default";
    returnUrl: "database" | "env" | "default";
  };
};

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://ajira.online"
  ).replace(/\/$/, "");
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function resolvePaynowConfig(): Promise<PaynowConfig> {
  const [dbId, dbKey, dbResult, dbReturn, dbEnabled] = await Promise.all([
    getSetting("paynow_integration_id", ""),
    getSetting("paynow_integration_key", ""),
    getSetting("paynow_result_url", ""),
    getSetting("paynow_return_url", ""),
    getSetting("paynow_enabled", "true"),
  ]);

  const envId = process.env.PAYNOW_INTEGRATION_ID ?? "";
  const envKey = process.env.PAYNOW_INTEGRATION_KEY ?? "";
  const envResult = process.env.PAYNOW_RESULT_URL ?? "";
  const envReturn = process.env.PAYNOW_RETURN_URL ?? "";

  const integrationId = dbId.trim() || envId.trim();
  const integrationKey = dbKey.trim() || envKey.trim();
  const resultUrl =
    dbResult.trim() ||
    envResult.trim() ||
    `${appBaseUrl()}/api/paynow/result`;
  const returnUrl =
    dbReturn.trim() ||
    envReturn.trim() ||
    `${appBaseUrl()}/dashboard/escrow/return`;

  return {
    integrationId,
    integrationKey,
    resultUrl,
    returnUrl,
    enabled: dbEnabled !== "false" && dbEnabled !== "0",
    sources: {
      integrationId: dbId.trim()
        ? "database"
        : envId.trim()
          ? "env"
          : "missing",
      integrationKey: dbKey.trim()
        ? "database"
        : envKey.trim()
          ? "env"
          : "missing",
      resultUrl: dbResult.trim() ? "database" : envResult.trim() ? "env" : "default",
      returnUrl: dbReturn.trim() ? "database" : envReturn.trim() ? "env" : "default",
    },
  };
}

/** Safe summary for admin UI (key is masked). */
export async function getPaynowStatusSummary() {
  const config = await resolvePaynowConfig();
  const configured = Boolean(config.integrationId && config.integrationKey);
  return {
    configured,
    enabled: config.enabled,
    ready: configured && config.enabled,
    integrationId: config.integrationId,
    integrationKeyMasked: maskSecret(config.integrationKey),
    hasIntegrationKey: Boolean(config.integrationKey),
    resultUrl: config.resultUrl,
    returnUrl: config.returnUrl,
    sources: config.sources,
  };
}

export async function isPaynowConfigured(): Promise<boolean> {
  const config = await resolvePaynowConfig();
  return Boolean(config.enabled && config.integrationId && config.integrationKey);
}

export async function getPaynowClient() {
  const config = await resolvePaynowConfig();
  if (!config.enabled) {
    throw new Error("Paynow gateway is disabled in admin settings.");
  }
  if (!config.integrationId || !config.integrationKey) {
    throw new Error(
      "Paynow is not configured. Set credentials in Admin → Payment gateway or env.",
    );
  }
  const paynow = new Paynow(config.integrationId, config.integrationKey);
  paynow.resultUrl = config.resultUrl;
  paynow.returnUrl = config.returnUrl;
  return paynow;
}

export async function initiateWebPayment(params: {
  reference: string;
  email?: string;
  description: string;
  amount: number;
  returnUrl?: string;
}) {
  const paynow = await getPaynowClient();
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
  const paynow = await getPaynowClient();
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
  const paynow = await getPaynowClient();
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
  const config = await resolvePaynowConfig();
  if (!config.integrationKey) return false;

  const ordered = Object.keys(payload)
    .filter((k) => k.toLowerCase() !== "hash")
    .sort()
    .map((k) => payload[k])
    .join("")
    .concat(config.integrationKey);

  const { createHash } = await import("crypto");
  const digest = createHash("sha512").update(ordered).digest("hex").toUpperCase();
  return digest === receivedHash.toUpperCase();
}

/** Local hash round-trip to verify crypto + key are usable. */
export async function testPaynowHash(): Promise<{ ok: boolean; message: string }> {
  const config = await resolvePaynowConfig();
  if (!config.integrationKey) {
    return { ok: false, message: "Integration key is missing." };
  }
  const sample = {
    reference: "AJIRA-HASH-TEST",
    amount: "1.00",
    status: "Paid",
  };
  const { createHash } = await import("crypto");
  const ordered = Object.keys(sample)
    .sort()
    .map((k) => sample[k as keyof typeof sample])
    .join("")
    .concat(config.integrationKey);
  const digest = createHash("sha512").update(ordered).digest("hex").toUpperCase();
  const valid = await verifyPaynowHash(sample, digest);
  return valid
    ? { ok: true, message: "Hash verification passed." }
    : { ok: false, message: "Hash verification failed." };
}

/**
 * Live connectivity test: initiate a $1 web checkout.
 * Does not complete payment — success means Paynow accepted the request.
 */
export async function testPaynowLiveInitiate(params?: {
  email?: string;
}): Promise<{
  ok: boolean;
  message: string;
  redirectUrl?: string;
  pollUrl?: string;
  reference?: string;
}> {
  if (!(await isPaynowConfigured())) {
    return {
      ok: false,
      message: "Gateway is not ready (disabled or missing credentials).",
    };
  }

  const reference = `AJIRA-TEST-${Date.now()}`;
  try {
    const result = await initiateWebPayment({
      reference,
      email: params?.email || "admin-test@ajira.online",
      description: "Ajira admin gateway test (do not pay)",
      amount: 1,
      returnUrl: `${appBaseUrl()}/dashboard/admin/gateway`,
    });
    if (!result.success) {
      return {
        ok: false,
        message: result.error ?? "Paynow rejected the test initiate.",
        reference,
      };
    }
    return {
      ok: true,
      message: "Paynow accepted the test initiate. You can ignore/cancel the checkout.",
      redirectUrl: result.redirectUrl,
      pollUrl: result.pollUrl,
      reference,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Test initiate failed.",
      reference,
    };
  }
}
