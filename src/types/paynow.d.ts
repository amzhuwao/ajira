declare module "paynow" {
  export class Paynow {
    resultUrl: string;
    returnUrl: string;
    constructor(integrationId: string, integrationKey: string);
    createPayment(reference: string, email?: string): Payment;
    send(payment: Payment): Promise<InitResponse>;
    sendMobile(
      payment: Payment,
      phone: string,
      method: "ecocash" | "onemoney",
    ): Promise<InitResponse>;
    pollTransaction(pollUrl: string): Promise<StatusResponse>;
  }

  export class Payment {
    add(title: string, amount: number): void;
  }

  export interface InitResponse {
    success: boolean;
    redirectUrl?: string;
    pollUrl?: string;
    instructions?: string;
    error?: string;
  }

  export interface StatusResponse {
    paid: boolean | (() => boolean);
    status?: string;
    amount?: string | number;
    reference?: string;
    paynowReference?: string;
  }
}
