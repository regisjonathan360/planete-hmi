import { handleMonCashCallback } from "../callback/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleMonCashCallback(request, true);
}
