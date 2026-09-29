import { NextRequest, NextResponse } from "next/server";
import { AppError, resolveConflict } from "@/lib/kasir";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const aksi = body?.aksi;
  if (aksi !== "adjust" && aksi !== "void") {
    return NextResponse.json(
      { error: 'aksi harus "adjust" atau "void"' },
      { status: 400 }
    );
  }
  try {
    const result = await resolveConflict(id, aksi);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
