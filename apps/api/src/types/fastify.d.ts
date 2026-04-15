import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    sessionUserId?: string;
    organizationId?: string;
    rawBody?: Buffer;
  }
}
