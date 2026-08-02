import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function ensureProjectConversation(params: {
  projectId: string;
  participantIds: string[];
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  const uniqueIds = [...new Set(params.participantIds.filter(Boolean))];

  const existing = await client.conversation.findUnique({
    where: { projectId: params.projectId },
    include: { participants: true },
  });

  if (existing) {
    const missing = uniqueIds.filter(
      (id) => !existing.participants.some((p) => p.userId === id),
    );
    if (missing.length > 0) {
      await client.conversationParticipant.createMany({
        data: missing.map((userId) => ({
          conversationId: existing.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    return existing;
  }

  return client.conversation.create({
    data: {
      projectId: params.projectId,
      participants: {
        create: uniqueIds.map((userId) => ({ userId })),
      },
    },
  });
}
