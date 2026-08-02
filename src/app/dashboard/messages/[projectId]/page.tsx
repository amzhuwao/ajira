import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { sendProjectMessageAction } from "@/lib/actions/messages";
import { ensureProjectConversation } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { formatDate, requireSession } from "@/lib/utils";

export default async function ProjectMessagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireSession();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      buyer: { select: { id: true, name: true } },
      escrow: true,
      bids: {
        where: { OR: [{ status: "ACCEPTED" }, { sellerId: session.user.id }] },
        select: { sellerId: true, status: true },
      },
      invites: { where: { sellerId: session.user.id }, take: 1 },
    },
  });
  if (!project) notFound();

  const isBuyer = project.buyerId === session.user.id;
  const isParty =
    isBuyer ||
    project.bids.some((b) => b.sellerId === session.user.id) ||
    project.invites.length > 0 ||
    session.user.role === "ADMIN";
  if (!isParty) notFound();

  const participantIds = new Set<string>([project.buyerId]);
  for (const bid of project.bids) participantIds.add(bid.sellerId);
  if (project.escrow) participantIds.add(project.escrow.sellerId);
  participantIds.add(session.user.id);

  await ensureProjectConversation({
    projectId: project.id,
    participantIds: [...participantIds],
  });

  const conversation = await prisma.conversation.findUnique({
    where: { projectId: project.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  if (conversation) {
    await prisma.conversationParticipant.updateMany({
      where: { conversationId: conversation.id, userId: session.user.id },
      data: { lastReadAt: new Date() },
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/messages" className="text-sm text-ink-soft">
        ← All messages
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{project.title}</h1>
          <p className="mt-2 text-ink-soft">
            Buyer: {project.buyer.name} · {project.status}
          </p>
        </div>
        <Link href={`/dashboard/projects/${project.id}`} className="btn btn-secondary">
          Project
        </Link>
      </div>

      <section className="panel mt-8 max-h-[28rem] space-y-4 overflow-y-auto">
        {(conversation?.messages.length ?? 0) === 0 ? (
          <p className="text-ink-soft">Start the conversation — ask about scope, files, or timing.</p>
        ) : (
          conversation?.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3 ${
                m.authorId === session.user.id ? "bg-forest/10 ml-8" : "bg-sand/60 mr-8"
              }`}
            >
              <div className="flex justify-between gap-2 text-xs text-ink-soft">
                <strong className="text-ink">{m.author.name}</strong>
                <span>{formatDate(m.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
              {m.attachmentUrl ? (
                <a
                  href={m.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-forest"
                >
                  Attachment: {m.attachmentName || "file"}
                </a>
              ) : null}
            </div>
          ))
        )}
      </section>

      <ActionForm action={sendProjectMessageAction} className="panel mt-6 flex flex-col gap-3">
        <input type="hidden" name="projectId" value={project.id} />
        <div>
          <label className="label" htmlFor="body">
            Message
          </label>
          <textarea className="textarea" id="body" name="body" required minLength={1} />
        </div>
        <div>
          <label className="label" htmlFor="attachment">
            Attachment (optional)
          </label>
          <input className="input" id="attachment" name="attachment" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" />
        </div>
        <button className="btn btn-primary self-start" type="submit">
          Send
        </button>
      </ActionForm>
    </div>
  );
}
