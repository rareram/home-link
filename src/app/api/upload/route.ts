import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

function uploadsDir() {
  return path.join(process.cwd(), "public", "uploads");
}

function randomName(ext: string) {
  const id = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${id}${ext}`;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    // 확장자 추정
    const name = (form.get("filename") as string) || "upload";
    const match = name.match(/\.[a-zA-Z0-9]+$/);
    const ext = match ? match[0].toLowerCase() : ".png";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const dir = uploadsDir();
    await fs.mkdir(dir, { recursive: true });

    const fname = randomName(ext);
    const fpath = path.join(dir, fname);
    await fs.writeFile(fpath, buffer);

    // public 경로로 접근
    const url = `/uploads/${fname}`;
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
