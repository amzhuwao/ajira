import { ActionForm } from "@/components/ui/action-form";
import {
  changePasswordAction,
  updateSellerProfileAction,
} from "@/lib/actions/profile";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Profile" };

function completion(user: {
  tagline: string | null;
  bio: string | null;
  skills: string | null;
  profileImageUrl: string | null;
  phone: string | null;
}) {
  const fields = [user.tagline, user.bio, user.skills, user.profileImageUrl, user.phone];
  return Math.round((fields.filter((f) => f && String(f).trim()).length / fields.length) * 100);
}

export default async function ProfilePage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const isSeller = user.role === "SELLER";
  const pct = completion(user);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl">Your profile</h1>
      <p className="mt-2 text-ink-soft">
        {user.name} · {user.email}
        {isSeller ? (
          <>
            {" · "}
            <Link href={`/dashboard/sellers/${user.id}`} className="text-forest">
              Public profile
            </Link>
          </>
        ) : null}
      </p>

      {isSeller ? (
        <>
          <div className="panel mt-6">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">
              Profile completion
            </div>
            <div className="mt-2 font-display text-3xl">{pct}%</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
              <div className="h-full bg-forest" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <ActionForm action={updateSellerProfileAction} className="panel mt-8 flex flex-col gap-4">
            <div>
              <label className="label" htmlFor="tagline">Tagline</label>
              <input className="input" id="tagline" name="tagline" defaultValue={user.tagline ?? ""} maxLength={160} />
            </div>
            <div>
              <label className="label" htmlFor="bio">Bio</label>
              <textarea className="textarea" id="bio" name="bio" defaultValue={user.bio ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="skills">Skills (comma-separated)</label>
              <input className="input" id="skills" name="skills" defaultValue={user.skills ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="availability">Availability</label>
              <select className="select" id="availability" name="availability" defaultValue={user.availability}>
                <option value="AVAILABLE">Available</option>
                <option value="BUSY">Busy</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="profileImageUrl">Profile image URL</label>
              <input className="input" id="profileImageUrl" name="profileImageUrl" type="url" defaultValue={user.profileImageUrl ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="coverImageUrl">Cover image URL</label>
              <input className="input" id="coverImageUrl" name="coverImageUrl" type="url" defaultValue={user.coverImageUrl ?? ""} />
            </div>
            <button className="btn btn-primary self-start" type="submit">Save profile</button>
          </ActionForm>
        </>
      ) : null}

      <ActionForm action={changePasswordAction} className="panel mt-8 flex flex-col gap-4">
        <h2 className="font-display text-2xl">Change password</h2>
        <div>
          <label className="label" htmlFor="currentPassword">Current password</label>
          <input className="input" id="currentPassword" name="currentPassword" type="password" required />
        </div>
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Confirm new password</label>
          <input className="input" id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
        </div>
        <button className="btn btn-secondary self-start" type="submit">Update password</button>
      </ActionForm>
    </div>
  );
}
