import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, requireSession } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function MessagesInboxPage() {
  const session = await requireSession();

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, title: true, status: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { id: true, name: true } } },
      },
      participants: {
        where: { userId: session.user.id },
        select: { lastReadAt: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Messages</h1>
      <p className="mt-2 text-ink-soft">Project workspaces for Q&amp;A and files.</p>

      <div className="mt-8 space-y-3">
        {conversations.length === 0 ? (
          <div className="panel text-ink-soft">
            No conversations yet. Message a seller after they bid, or accept a bid to open a room.
          </div>
        ) : (
          conversations.map((c) => {
            const last = c.messages[0];
            const lastRead = c.participants[0]?.lastReadAt;
            const unread =
              last &&
              last.author.id !== session.user.id &&
              (!lastRead || last.createdAt > lastRead);
            return (
              <Link
                key={c.id}
                href={`/dashboard/messages/${c.project.id}`}
                className="card block"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{c.project.title}</h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {last
                        ? `${last.author.name}: ${last.body.slice(0, 100)}`
                        : "No messages yet"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink-soft">
                    <div>{c.project.status}</div>
                    {last ? <div className="mt-1">{formatDate(last.createdAt)}</div> : null}
                    {unread ? <span className="badge mt-2 inline-block">New</span> : null}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
