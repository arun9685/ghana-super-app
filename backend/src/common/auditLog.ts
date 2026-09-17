import { prisma } from "@/database/prisma";
import { logger } from "@/common/logger";

// Generic append-only audit trail (see AuditLog in prisma/schema.prisma).
// Intentionally best-effort: a failure to *write* an audit entry must never
// fail the underlying action it's describing (a payment already went
// through; we don't want to roll that back because a log insert hiccupped),
// so this swallows its own errors after logging them loudly.
interface AuditLogInput {
  actorId?: string | null;
  actorType: "USER" | "SYSTEM" | "WEBHOOK";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorType: input.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as never,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, input }, "Failed to write audit log entry");
  }
}
