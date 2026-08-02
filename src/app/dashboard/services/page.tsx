import { ActionForm } from "@/components/ui/action-form";
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
} from "@/lib/actions/profile";
import { prisma } from "@/lib/prisma";
import { formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const session = await requireRole("SELLER");
  const services = await prisma.service.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Your services</h1>
      <p className="mt-2 text-ink-soft">
        List gigs buyers can see on your public profile.
      </p>

      <ActionForm action={createServiceAction} className="panel mt-8 flex flex-col gap-4">
        <h2 className="font-display text-2xl">Add service</h2>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input className="input" id="title" name="title" required minLength={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="price">Price (USD)</label>
            <input className="input" id="price" name="price" type="number" step="0.01" min="1" required />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <input className="input" id="category" name="category" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="select" id="status" name="status" defaultValue="ACTIVE">
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="PAUSED">Paused</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea className="textarea" id="description" name="description" required minLength={10} />
        </div>
        <button className="btn btn-primary self-start" type="submit">Create service</button>
      </ActionForm>

      <section className="mt-10 space-y-4">
        {services.map((service) => (
          <div key={service.id} className="panel">
            <ActionForm action={updateServiceAction} className="flex flex-col gap-3">
              <input type="hidden" name="serviceId" value={service.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input className="input font-semibold" name="title" defaultValue={service.title} required />
                <span className="badge">{service.status}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <input className="input" name="price" type="number" step="0.01" defaultValue={Number(service.price)} required />
                <input className="input" name="category" defaultValue={service.category ?? ""} placeholder="Category" />
                <select className="select" name="status" defaultValue={service.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
              <textarea className="textarea" name="description" defaultValue={service.description} required />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary" type="submit">Save</button>
                <span className="text-sm text-ink-soft self-center">
                  Listed at {formatMoney(service.price)}
                </span>
              </div>
            </ActionForm>
            <form
              action={async () => {
                "use server";
                await deleteServiceAction(service.id);
              }}
              className="mt-3"
            >
              <button className="btn btn-ghost" type="submit">Delete</button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
