import { NextResponse } from "next/server";
import { getUserState } from "@/lib/user-state";

export async function GET() {
  try {
    const userState = await getUserState();
    return NextResponse.json(userState);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch user state",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

