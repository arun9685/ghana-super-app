// Real integration point: a production credit-scoring/underwriting call
// (e.g. bureau data, mobile-money transaction history, an in-house risk
// model) would decide APPROVED/REJECTED and a credit limit here. Same
// provider-independent shape as SmsProvider/PaymentProvider — nothing in
// liquidity.service.ts needs to change when a real one is wired in.
export interface LoanDecisionProvider {
  decide(userId: string, amountCents: number): Promise<{ approved: boolean; reason: string }>;
}

class ManualReviewLoanProvider implements LoanDecisionProvider {
  // No automated scoring yet — every application starts PENDING and
  // waits for a human (PLATFORM_ADMIN) decision via the admin endpoint.
  // This still "decides" nothing automatically; it exists so the shape
  // is in place for an automated scorer later.
  async decide(): Promise<{ approved: boolean; reason: string }> {
    return { approved: false, reason: "Manual review required — no automated scoring configured" };
  }
}

export function getLoanDecisionProvider(): LoanDecisionProvider {
  return new ManualReviewLoanProvider();
}
