import { ActionForm } from "@/components/ui/action-form";
import { createProjectAction } from "@/lib/actions/projects";
import { requireRole } from "@/lib/utils";

export const metadata = { title: "Post a project" };

export default async function NewProjectPage() {
  await requireRole("BUYER", "ADMIN");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl">Post a project</h1>
      <p className="mt-2 text-ink-soft">
        Describe the work clearly. Sellers will bid within your budget range.
      </p>

      <ActionForm action={createProjectAction} className="panel mt-8 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input className="input" id="title" name="title" required minLength={5} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <input className="input" id="category" name="category" placeholder="Design, Dev, Writing…" />
          </div>
          <div>
            <label className="label" htmlFor="timeline">
              Timeline
            </label>
            <select className="select" id="timeline" name="timeline" defaultValue="FLEXIBLE">
              <option value="URGENT">Urgent</option>
              <option value="SHORT">Short</option>
              <option value="MEDIUM">Medium</option>
              <option value="FLEXIBLE">Flexible</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="budgetMin">
              Min budget (USD)
            </label>
            <input className="input" id="budgetMin" name="budgetMin" type="number" step="0.01" min="1" required />
          </div>
          <div>
            <label className="label" htmlFor="budgetMax">
              Max budget (USD)
            </label>
            <input className="input" id="budgetMax" name="budgetMax" type="number" step="0.01" min="1" required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea className="textarea" id="description" name="description" required minLength={20} />
        </div>
        <button className="btn btn-primary self-start" type="submit">
          Publish project
        </button>
      </ActionForm>
    </div>
  );
}
