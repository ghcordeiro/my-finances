import { closeTestApp } from "./test-app.js";

export default async function globalTeardown(): Promise<void> {
  await closeTestApp();
}
