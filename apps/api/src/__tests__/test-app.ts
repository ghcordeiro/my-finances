import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

let singleton: FastifyInstance | null = null;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!singleton) {
    singleton = await buildApp();
    await singleton.ready();
  }
  return singleton;
}

export async function closeTestApp(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}
