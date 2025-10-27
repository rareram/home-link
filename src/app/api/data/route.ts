import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

type HealthMethod = "HEAD" | "GET";
type AppLink = {
  id: string;
  name: string;
  url: string;
  gitUrl?: string;
  description?: string;
  detailsMd?: string;
  logoUrl?: string;
  certRenewalDate?: string;
  tokenExpiryDate?: string;
  pinned?: boolean;
  favorite?: boolean;
  healthUrl?: string;
  healthMethod?: HealthMethod;
  healthOkMin?: number;
  tags?: string[];
};

type ThemeId = "classic" | "ocean" | "carbon" | "sunset";
type SortMode = "urgency" | "alpha_asc" | "alpha_desc" | "pinned_fav_urgency";
type OpenMode = "new_tab" | "same_tab";

type Settings = {
  siteTitle: string;
  siteSubtitle: string;
  siteLogo?: string;
  theme: ThemeId;
  sortMode: SortMode;
  openMode: OpenMode;
  adminMode: boolean;
  healthEnabled: boolean;
  healthIntervalSec: number;
  healthShowMs: boolean;
  colors?: { star?: string; favBar?: string; pin?: string };
};

type Payload = { version: number; items: AppLink[]; settings: Settings };

const DEFAULTS: Payload = {
  version: 1,
  items: [],
  settings: {
    siteTitle: "홈링크웹",
    siteSubtitle: "런처 중심 · 소스위치 · 만료 카운트",
    theme: "classic",
    sortMode: "alpha_asc", // 기본값 변경
    openMode: "new_tab",
    adminMode: true,
    healthEnabled: true,
    healthIntervalSec: 30,
    healthShowMs: true,
    colors: { star: "#f59e0b", favBar: "#f59e0b", pin: "#0ea5e9" },
  },
};

function dataFilePath() {
  return path.join(process.cwd(), "data", "home-links.json");
}
async function ensureDir(dir: string) { try { await fs.mkdir(dir, { recursive: true }); } catch {} }

export async function GET() {
  try {
    const file = dataFilePath();
    try {
      const raw = await fs.readFile(file, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      await ensureDir(path.dirname(file));
      await fs.writeFile(file, JSON.stringify(DEFAULTS, null, 2), "utf-8");
      return NextResponse.json(DEFAULTS);
    }
  } catch {
    return NextResponse.json({ error: "failed to load" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || !("items" in body) || !("settings" in body)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    const file = dataFilePath();
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed to save" }, { status: 500 });
  }
}
