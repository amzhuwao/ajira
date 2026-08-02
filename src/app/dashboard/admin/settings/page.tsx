import { ActionForm } from "@/components/ui/action-form";
import { updatePlatformSettingsAction } from "@/lib/actions/admin";
import { getAllSettings } from "@/lib/settings";
import { requireRole } from "@/lib/utils";

export const metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  const settings = await getAllSettings();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Platform settings</h1>
      <p className="mt-2 text-ink-soft">Commission, limits, KYC, and legal copy.</p>

      <ActionForm action={updatePlatformSettingsAction} className="panel mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="commission_percentage">Commission %</label>
          <input className="input" id="commission_percentage" name="commission_percentage" type="number" step="0.1" defaultValue={settings.commission_percentage} required />
        </div>
        <div>
          <label className="label" htmlFor="refund_fee_percentage">Refund fee %</label>
          <input className="input" id="refund_fee_percentage" name="refund_fee_percentage" type="number" step="0.1" defaultValue={settings.refund_fee_percentage} required />
        </div>
        <div>
          <label className="label" htmlFor="min_escrow_amount">Min escrow (USD)</label>
          <input className="input" id="min_escrow_amount" name="min_escrow_amount" type="number" step="0.01" defaultValue={settings.min_escrow_amount} required />
        </div>
        <div>
          <label className="label" htmlFor="max_transaction_amount">Max transaction (USD)</label>
          <input className="input" id="max_transaction_amount" name="max_transaction_amount" type="number" step="0.01" defaultValue={settings.max_transaction_amount} required />
        </div>
        <div>
          <label className="label" htmlFor="auto_release_days">Auto-release days</label>
          <input className="input" id="auto_release_days" name="auto_release_days" type="number" defaultValue={settings.auto_release_days} required />
        </div>
        <div>
          <label className="label" htmlFor="dispute_resolution_days">Dispute resolution days</label>
          <input className="input" id="dispute_resolution_days" name="dispute_resolution_days" type="number" defaultValue={settings.dispute_resolution_days} required />
        </div>
        <div>
          <label className="label" htmlFor="kyc_required_for_seller">KYC required for sellers</label>
          <select className="select" id="kyc_required_for_seller" name="kyc_required_for_seller" defaultValue={settings.kyc_required_for_seller}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="maintenance_mode">Maintenance mode</label>
          <select className="select" id="maintenance_mode" name="maintenance_mode" defaultValue={settings.maintenance_mode}>
            <option value="false">Off</option>
            <option value="true">On</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="tos_text">Terms of service (public /terms)</label>
          <p className="mb-2 text-xs text-ink-soft">
            Leave blank to use the built-in AdSense-ready terms. Custom text should stay comprehensive.
          </p>
          <textarea className="textarea" id="tos_text" name="tos_text" defaultValue={settings.tos_text} rows={8} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="privacy_text">Privacy policy (public /privacy)</label>
          <p className="mb-2 text-xs text-ink-soft">
            Leave blank to use the built-in policy (includes Google AdSense cookie disclosures).
          </p>
          <textarea className="textarea" id="privacy_text" name="privacy_text" defaultValue={settings.privacy_text} rows={8} />
        </div>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" type="submit">Save settings</button>
        </div>
      </ActionForm>
    </div>
  );
}
