import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function AdminEscrowsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const escrows = await prisma.escrow.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      project: true,
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Escrows</h1>
      <div className="mt-8 space-y-3">
        {escrows.map((e) => (
          <Link key={e.id} href={`/dashboard/escrow/${e.id}`} className="card block hover:border-forest">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-semibold">{e.project.title}</div>
                <div className="text-sm text-ink-soft">
                  {formatMoney(e.amount)} · {e.buyer.name} → {e.seller.name} ·{" "}
                  {formatDate(e.createdAt)}
                </div>
              </div>
              <span className="badge">{e.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
