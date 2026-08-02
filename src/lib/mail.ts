import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

export function getMailFrom(): string {
  return process.env.MAIL_FROM ?? "Ajira <info@ajira.online>";
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; preview?: string }> {
  if (!smtpConfigured()) {
    console.info("[mail:stub]", opts.to, opts.subject, opts.text);
    return { sent: false, preview: opts.text };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: getMailFrom(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
  });

  return { sent: true };
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  role: string;
  tempPassword?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
  const passwordLine = opts.tempPassword
    ? `\nTemporary password: ${opts.tempPassword}\nPlease sign in and change it soon.\n`
    : "";

  return sendMail({
    to: opts.to,
    subject: "Welcome to Ajira",
    text: `Hi ${opts.name},

Your Ajira ${opts.role.toLowerCase()} account is ready.

Sign in: ${appUrl}/login
Email: ${opts.to}${passwordLine}
— Ajira`,
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  return sendMail({
    to: opts.to,
    subject: "Reset your Ajira password",
    text: `Hi ${opts.name},

We received a request to reset your Ajira password.

Reset your password (link expires in 1 hour):
${opts.resetUrl}

If you did not request this, you can ignore this email. Your password will stay the same.

— Ajira`,
  });
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
}

export async function sendBidAcceptedEmail(opts: {
  sellerEmail: string;
  sellerName: string;
  buyerEmail: string;
  buyerName: string;
  projectTitle: string;
  amount: string;
  escrowUrl: string;
}) {
  await Promise.all([
    sendMail({
      to: opts.sellerEmail,
      subject: `Bid accepted: ${opts.projectTitle}`,
      text: `Hi ${opts.sellerName},

Your bid on "${opts.projectTitle}" was accepted for ${opts.amount}.

Funded escrow details: ${opts.escrowUrl}

— Ajira`,
    }),
    sendMail({
      to: opts.buyerEmail,
      subject: `Bid accepted: ${opts.projectTitle}`,
      text: `Hi ${opts.buyerName},

You accepted a bid on "${opts.projectTitle}" for ${opts.amount}.

Fund escrow here: ${opts.escrowUrl}

— Ajira`,
    }),
  ]);
}

export async function sendWorkDeliveredEmail(opts: {
  to: string;
  name: string;
  projectTitle: string;
  projectUrl: string;
}) {
  return sendMail({
    to: opts.to,
    subject: `Work delivered: ${opts.projectTitle}`,
    text: `Hi ${opts.name},

The seller marked "${opts.projectTitle}" as delivered. Please review and approve.

${opts.projectUrl}

— Ajira`,
  });
}

export async function sendEscrowReleasedEmail(opts: {
  sellerEmail: string;
  sellerName: string;
  buyerEmail: string;
  buyerName: string;
  projectTitle: string;
  amount: string;
}) {
  await Promise.all([
    sendMail({
      to: opts.sellerEmail,
      subject: `Funds released: ${opts.projectTitle}`,
      text: `Hi ${opts.sellerName},

${opts.amount} for "${opts.projectTitle}" was released to your Ajira wallet.

Wallet: ${appUrl()}/dashboard/wallet

— Ajira`,
    }),
    sendMail({
      to: opts.buyerEmail,
      subject: `Project completed: ${opts.projectTitle}`,
      text: `Hi ${opts.buyerName},

You approved work on "${opts.projectTitle}". Funds were released to the seller.

— Ajira`,
    }),
  ]);
}

export async function sendReviewSubmittedEmail(opts: {
  to: string;
  name: string;
  rating: number;
  projectTitle: string;
  profileUrl: string;
}) {
  return sendMail({
    to: opts.to,
    subject: `New ${opts.rating}★ review on Ajira`,
    text: `Hi ${opts.name},

You received a ${opts.rating}-star review for "${opts.projectTitle}".

View your profile: ${opts.profileUrl}

— Ajira`,
  });
}

export async function sendDisputeOpenedEmail(opts: {
  parties: Array<{ email: string; name: string }>;
  projectTitle: string;
  disputeUrl: string;
}) {
  await Promise.all(
    opts.parties.map((p) =>
      sendMail({
        to: p.email,
        subject: `Dispute opened: ${opts.projectTitle}`,
        text: `Hi ${p.name},

A dispute was opened for "${opts.projectTitle}".

${opts.disputeUrl}

— Ajira`,
      }),
    ),
  );
}

export async function sendDisputeResolvedEmail(opts: {
  parties: Array<{ email: string; name: string }>;
  projectTitle: string;
  resolution: string;
  disputeUrl: string;
}) {
  await Promise.all(
    opts.parties.map((p) =>
      sendMail({
        to: p.email,
        subject: `Dispute resolved: ${opts.projectTitle}`,
        text: `Hi ${p.name},

The dispute for "${opts.projectTitle}" was resolved: ${opts.resolution}

${opts.disputeUrl}

— Ajira`,
      }),
    ),
  );
}
