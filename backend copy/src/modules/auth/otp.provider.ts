import { logger } from "@/common/logger";
import { env } from "@/config/env";

// spec §68: "provider-independent" is a core architecture principle.
// Every SMS provider (Twilio, Hubtel, Africa's Talking — all common choices
// for Ghana) implements this one interface. Nothing in auth.service.ts
// needs to change when you switch providers or add a second one for
// failover.
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

// Local/dev implementation — logs the OTP instead of sending a real SMS,
// so the full flow is testable with zero external accounts or cost. This
// is intentionally the default in .env.example.
//
// It also keeps the last code sent per phone number in memory. That's safe
// here specifically because this provider's entire purpose is to put the
// plaintext OTP somewhere a developer (or a test) can read it instead of
// sending a real SMS — logging it to the console already does the same
// thing. `getLastOtpForTesting` just makes that same value readable from
// code instead of only from log output, so the integration test suite can
// drive the real verify-otp endpoint instead of stopping short of it.
const lastSentOtp = new Map<string, string>();

export function getLastOtpForTesting(phone: string): string | undefined {
  return lastSentOtp.get(phone);
}

class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    lastSentOtp.set(phone, code);
    logger.info({ phone }, `[DEV SMS] OTP for ${phone} is ${code} (valid ${env.OTP_TTL_MIN} min)`);
  }
}

// Fill these in once real credentials exist. The shape is deliberately
// identical to ConsoleSmsProvider so swapping SMS_PROVIDER in .env is the
// only change required anywhere in the codebase.

class TwilioSmsProvider implements SmsProvider {
  async sendOtp(_phone: string, _code: string): Promise<void> {
    throw new Error(
      "TwilioSmsProvider is not implemented yet. Add the Twilio SDK, set " +
        "SMS_PROVIDER_API_KEY, and implement this method — see " +
        "https://www.twilio.com/docs/sms/send-messages"
    );
  }
}

class HubtelSmsProvider implements SmsProvider {
  async sendOtp(_phone: string, _code: string): Promise<void> {
    throw new Error(
      "HubtelSmsProvider is not implemented yet. Hubtel is a common choice " +
        "for Ghana-specific SMS delivery — implement against their SMS API " +
        "and set SMS_PROVIDER_API_KEY."
    );
  }
}

class AfricasTalkingSmsProvider implements SmsProvider {
  async sendOtp(_phone: string, _code: string): Promise<void> {
    throw new Error(
      "AfricasTalkingSmsProvider is not implemented yet. Implement against " +
        "the Africa's Talking SMS API and set SMS_PROVIDER_API_KEY."
    );
  }
}

export function getSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "twilio":
      return new TwilioSmsProvider();
    case "hubtel":
      return new HubtelSmsProvider();
    case "africastalking":
      return new AfricasTalkingSmsProvider();
    case "console":
    default:
      return new ConsoleSmsProvider();
  }
}
