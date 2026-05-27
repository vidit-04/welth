import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCalendarData } from "@/actions/calendar";

export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") || now.getUTCFullYear(), 10);
    const month = parseInt(searchParams.get("month") || now.getUTCMonth() + 1, 10);
    const accountId = searchParams.get("accountId") || "all";

    const data = await getCalendarData({ accountId, year, month });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
