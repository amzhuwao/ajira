import Link from "next/link";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { prisma } from "@/lib/prisma";
import { formatDate, requireSession } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Notifications</h1>
          <p className="mt-2 text-ink-soft">Bids, messages, payments, and invites.</p>
        </div>
        <form
          action={async () => {
            "use server";
            await markAllNotificationsReadAction();
          }}
        >
          <button className="btn btn-secondary" type="submit">
            Mark all read
          </button>
        </form>
      </div>

      <div className="mt-8 space-y-3">
        {notifications.length === 0 ? (
          <div className="panel text-ink-soft">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`panel ${n.readAt ? "opacity-70" : "ring-1 ring-forest/20"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-ink-soft">{n.type}</p>
                  <h2 className="mt-1 font-semibold">{n.title}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{n.body}</p>
                  <p className="mt-2 text-xs text-ink-soft">{formatDate(n.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {n.href ? (
                    <Link href={n.href} className="btn btn-secondary">
                      Open
                    </Link>
                  ) : null}
                  {!n.readAt ? (
                    <form
                      action={async () => {
                        "use server";
                        await markNotificationReadAction(n.id);
                      }}
                    >
                      <button className="btn btn-ghost" type="submit">
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
