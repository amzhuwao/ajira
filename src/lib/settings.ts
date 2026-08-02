import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS: Record<string, string> = {
  commission_percentage: "10",
  refund_fee_percentage: "0",
  min_escrow_amount: "5",
  max_transaction_amount: "50000",
  auto_release_days: "14",
  dispute_resolution_days: "7",
  kyc_required_for_seller: "false",
  maintenance_mode: "false",
  tos_text: "By using Ajira you agree to our terms of service.",
  privacy_text: "Ajira processes account and payment data to operate the marketplace.",
};

export async function ensureDefaultSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.platformSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}

export async function getSetting(key: string, fallback?: string): Promise<string> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (row) return row.value;
  return fallback ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettingNumber(key: string, fallback = 0): Promise<number> {
  const raw = await getSetting(key, String(fallback));
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const raw = await getSetting(key, String(fallback));
  return raw === "true" || raw === "1";
}

export async function setSetting(key: string, value: string) {
  return prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  await ensureDefaultSettings();
  const rows = await prisma.platformSetting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export function computeCommission(amount: number, percent: number) {
  const fee = Math.round(amount * (percent / 100) * 100) / 100;
  const net = Math.round((amount - fee) * 100) / 100;
  return { fee, net: Math.max(0, net) };
}
