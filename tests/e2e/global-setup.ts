import { assertSafeTestDatabase } from "../helpers/safety";

export default async function globalSetup() {
  assertSafeTestDatabase();
}
