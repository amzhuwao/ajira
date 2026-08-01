import { EscrowStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const VALID_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  PENDING: [EscrowStatus.FUNDED, EscrowStatus.CANCELED],
  FUNDED: [
    EscrowStatus.RELEASE_REQUESTED,
    EscrowStatus.REFUND_REQUESTED,
    EscrowStatus.DISPUTED,
  ],
  RELEASE_REQUESTED: [EscrowStatus.RELEASED, EscrowStatus.DISPUTED],
  REFUND_REQUESTED: [EscrowStatus.REFUNDED, EscrowStatus.DISPUTED],
  DISPUTED: [EscrowStatus.RELEASED, EscrowStatus.REFUNDED],
  RELEASED: [],
  REFUNDED: [],
  CANCELED: [],
};

export function isTransitionAllowed(from: EscrowStatus, to: EscrowStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

type TransitionOptions = {
  triggeredBy?: string;
  userId?: string;
  reason?: string;
  metadata?: Record<string, unknown> | string | null;
  tx?: Prisma.TransactionClient;
};

export async function transitionEscrow(
  escrowId: string,
  toStatus: EscrowStatus,
  options: TransitionOptions = {},
) {
  const {
    triggeredBy = "system",
    userId,
    reason,
    metadata,
    tx,
  } = options;

  const run = async (client: Prisma.TransactionClient) => {
    const escrow = await client.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) {
      throw new Error("Escrow not found");
    }

    if (escrow.status === toStatus) {
      return escrow;
    }

    if (!isTransitionAllowed(escrow.status, toStatus)) {
      throw new Error(`Invalid transition: ${escrow.status} -> ${toStatus}`);
    }

    const data: Prisma.EscrowUpdateInput = {
      status: toStatus,
    };

    if (toStatus === EscrowStatus.FUNDED) {
      data.fundedAt = new Date();
    }
    if (toStatus === EscrowStatus.RELEASED) {
      data.releasedAt = new Date();
    }

    const updated = await client.escrow.update({
      where: { id: escrowId, status: escrow.status },
      data,
    });

    const metadataStr =
      metadata == null
        ? null
        : typeof metadata === "string"
          ? metadata
          : JSON.stringify(metadata);

    await client.escrowTransition.create({
      data: {
        escrowId,
        fromStatus: escrow.status,
        toStatus,
        triggeredBy,
        userId: userId ?? null,
        reason: reason ?? null,
        metadata: metadataStr,
      },
    });

    if (toStatus === EscrowStatus.FUNDED) {
      await client.project.update({
        where: { id: escrow.projectId },
        data: { status: "IN_PROGRESS" },
      });
    } else if (toStatus === EscrowStatus.RELEASED) {
      await client.project.update({
        where: { id: escrow.projectId },
        data: { status: "COMPLETED" },
      });
    } else if (toStatus === EscrowStatus.DISPUTED) {
      await client.project.update({
        where: { id: escrow.projectId },
        data: { status: "DISPUTED" },
      });
    } else if (toStatus === EscrowStatus.CANCELED || toStatus === EscrowStatus.REFUNDED) {
      await client.project.update({
        where: { id: escrow.projectId },
        data: { status: "CANCELLED" },
      });
    }

    return updated;
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(async (client) => run(client));
}
