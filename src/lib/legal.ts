export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://ajira.online").replace(/\/$/, "");
}

export const DEFAULT_PRIVACY_POLICY = `Last updated: 2 August 2026

Ajira ("we", "us", "our") operates the freelance marketplace at ajira.online. This Privacy Policy explains what information we collect, how we use it, and your choices. By using Ajira you agree to this policy.

1. Who we are
Ajira is a Zimbabwe-focused marketplace that connects buyers and freelancers and holds project payments in escrow via Paynow until work is approved. Contact: info@ajira.online

2. Information we collect
- Account data: name, email, phone number, password (hashed), role (buyer/seller/admin), profile details (bio, skills, images), KYC verification status.
- Transaction data: projects, bids, escrow amounts, payment references, wallet balances, withdrawals, disputes, messages, and related timestamps.
- Technical data: IP address, browser type, device information, approximate location derived from IP, pages visited, and cookie/local storage identifiers.
- Communications: emails we send you, support requests, and in-app messages or dispute evidence you upload.

3. How we use information
We use data to create and secure accounts, run escrow and payouts, prevent fraud and abuse, provide customer support, improve the product, send transactional notices (bids, payments, disputes, password resets), and — if you consent — limited marketing updates. We do not sell your personal information.

4. Payments
Payments are processed by Paynow and connected mobile-money providers (such as Ecocash and OneMoney). We receive payment status and reference data needed to fund, release, or refund escrow. Card and mobile-money credentials are handled by Paynow, not stored on Ajira servers.

5. Cookies and similar technologies
We use essential cookies/local storage for authentication, security, and remembering preferences (for example cookie-consent choice). If advertising or analytics partners are enabled, they may set cookies or use web beacons and IP addresses to measure traffic or serve ads.

6. Advertising (Google AdSense and partners)
When ads are enabled on Ajira:
- Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites.
- Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to this site and/or other sites on the Internet.
- Users may opt out of personalized advertising by visiting Google Ads Settings at https://www.google.com/settings/ads or by visiting https://www.aboutads.info.
- Learn how Google uses data when you use our partners' sites or apps: https://policies.google.com/technologies/partner-sites

7. Sharing
We share data with: Paynow and payment rails for transactions; email delivery providers for transactional mail; cloud/hosting providers that process data on our instructions; and authorities when required by law. We may share aggregated, non-identifying statistics publicly.

8. Retention
We keep account and transaction records for as long as your account is active and for a reasonable period afterward to meet legal, tax, dispute, and fraud-prevention obligations. You may request account closure by contacting info@ajira.online.

9. Security
We use industry-standard measures including password hashing, HTTPS, role-based access controls, and escrow state auditing. No method of transmission or storage is 100% secure.

10. International transfers
Our infrastructure and partners may process data in countries other than Zimbabwe. Where we do so, we take steps appropriate to the context to protect your information.

11. Your choices
You can update profile information in your dashboard, request access or deletion where applicable by emailing info@ajira.online, and manage cookie preferences via our cookie notice. Essential cookies cannot be disabled while you use the logged-in product.

12. Children
Ajira is not directed at children under 16. We do not knowingly collect personal information from children.

13. Changes
We may update this policy. Material changes will be reflected by updating the "Last updated" date and, where appropriate, notifying account holders by email or in-app notice.

14. Contact
Questions about privacy: info@ajira.online`;

export const DEFAULT_TERMS_OF_SERVICE = `Last updated: 2 August 2026

These Terms of Service ("Terms") govern use of Ajira at ajira.online. By creating an account or using the site you agree to these Terms.

1. The service
Ajira is an online marketplace where buyers post projects or order services and sellers offer freelance work. Payments may be held in escrow via Paynow until milestones or deliverables are approved, refunded, or resolved through dispute processes.

2. Eligibility
You must be legally able to enter a contract, provide accurate registration information, and keep credentials confidential. We may suspend or terminate accounts that are inaccurate, abusive, fraudulent, or illegal.

3. Accounts and roles
Buyers hire; sellers deliver work; admins moderate. You are responsible for activity under your account. Sellers may need KYC verification before bidding or withdrawing, as configured by platform settings.

4. Projects, bids, and services
Project briefs, proposals, and service packages must be truthful and lawful. You must not post prohibited content (illegal services, malware, hate, adult content involving minors, weapons trafficking, or other content that violates applicable law or Google Publisher Policies when ads are shown). Ajira may remove listings that violate these Terms.

5. Escrow, fees, and payouts
When a bid is accepted or a catalog order is placed, an escrow record is created. Buyers fund escrow through Paynow. Platform commission may be deducted on release according to current settings. Sellers withdraw through supported methods subject to review. Currency framing is generally USD for display; actual settlement follows Paynow and local payment rails.

6. Delivery, approval, and disputes
Sellers should deliver as agreed. Buyers should review promptly. Disputes may be opened on funded escrows; Ajira may request evidence and decide release, refund, or split. Bad-faith disputes or chargebacks may lead to account action.

7. Messaging and files
Project messages and uploads are for legitimate collaboration. Do not share malware, spam, or personal data of others without permission. We may retain messages for safety and dispute resolution.

8. Intellectual property
You keep ownership of content you create. You grant Ajira a license to host and display it as needed to operate the marketplace. Ajira branding and software remain our property.

9. Prohibited conduct
No scraping that harms the service, no circumventing escrow to avoid fees for platform-introduced work without agreement, no impersonation, and no attempts to attack or disrupt the platform.

10. Advertising
Ajira may display third-party advertisements, including Google AdSense. Ads are labeled and are not endorsements of products or services.

11. Disclaimers
The marketplace is provided "as is." We do not guarantee continuous availability, specific earnings, or that every user will behave lawfully. Escrow reduces but does not eliminate transaction risk.

12. Limitation of liability
To the fullest extent permitted by law, Ajira's liability for claims arising from the service is limited to fees you paid to Ajira in the three months before the claim. We are not liable for indirect or consequential damages.

13. Indemnity
You agree to indemnify Ajira against claims arising from your content, projects, or violation of these Terms.

14. Changes and termination
We may update Terms by posting a new version. Continued use after the effective date constitutes acceptance. We may suspend access for violations or risk.

15. Governing law
These Terms are governed by the laws of Zimbabwe, without regard to conflict-of-law rules. Courts in Zimbabwe have exclusive jurisdiction, except where consumer protections require otherwise.

16. Contact
info@ajira.online`;
