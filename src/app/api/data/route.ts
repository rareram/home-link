import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// --- Types ---
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

type GlobalSettings = {
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
  colors?: { star?: string; favBar?: string; pin?: string; pinBg?: string };
};

type UserData = {
  items: AppLink[];
  settings?: Partial<GlobalSettings>;
};

type FullData = {
  version: number;
  globalSettings: GlobalSettings;
  common: UserData;
  users: Record<string, UserData>;
};

// --- Constants ---
const DEFAULTS: FullData = {
  version: 2,
  globalSettings: {
    siteTitle: "홈링크웹",
    siteSubtitle: "런처 중심 · 소스위치 · 만료 카운트",
    theme: "classic",
    sortMode: "alpha_asc",
    openMode: "new_tab",
    adminMode: true,
    healthEnabled: true,
    healthIntervalSec: 30,
    healthShowMs: true,
    colors: { star: "#f59e0b", favBar: "#f59e0b", pin: "#0ea5e9" },
  },
  common: {
    items: [],
  },
  users: {
    admin: {
      items: [],
      settings: {},
    },
  },
};

// --- File I/O ---
function dataFilePath() {
  return path.join(process.cwd(), "data", "home-links.json");
}

async function readDataFile(): Promise<FullData> {
  const file = dataFilePath();
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as FullData;
  } catch (error: any) {
    if (error.code === 'ENOENT') { // File not found, create with defaults
      await ensureDir(path.dirname(file));
      await fs.writeFile(file, JSON.stringify(DEFAULTS, null, 2), "utf-8");
      return DEFAULTS;
    }
    console.error("Error reading or parsing data file:", error);
    // If file exists but is corrupt, return defaults as a fallback without overwriting the file
    // This prevents an infinite loop of overwriting a potentially good file with bad defaults
    return DEFAULTS;
  }
}

async function writeDataFile(data: FullData) {
  const file = dataFilePath();
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

// --- API Handlers ---

class AsyncMutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const fileMutex = new AsyncMutex();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user") || "admin"; // Default to 'admin'

    const data = await readDataFile();

    const globalSettings = data.globalSettings;
    const userSettings = data.users?.[user]?.settings || {};
    const effectiveSettings = { ...globalSettings, ...userSettings };

    const commonItems = data.common?.items || [];
    const userItems = data.users?.[user]?.items || [];

    // Combine items, with user-specific items taking precedence
    const combinedItemsMap = new Map<string, AppLink>();

    // Add common items first
    commonItems.forEach(item => combinedItemsMap.set(item.id, item));

    // Add user-specific items, overwriting common items if IDs conflict
    userItems.forEach(item => combinedItemsMap.set(item.id, item));

    const responsePayload = {
      settings: effectiveSettings,
      items: Array.from(combinedItemsMap.values()),
    };

    return NextResponse.json(responsePayload);
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "failed to load", details: error }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await fileMutex.acquire();
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user");

    if (!user) {
      return NextResponse.json({ error: "User must be specified for POST" }, { status: 400 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const data = await readDataFile();

    // Ensure user data structure exists
    if (!data.users) {
      data.users = {};
    }
    if (!data.users[user]) {
      data.users[user] = { items: [] };
    }

    if (user === "admin") {
      if ("settings" in body) {
        data.globalSettings = { ...data.globalSettings, ...body.settings };
      }
      if ("items" in body) {
        data.common.items = body.items;
        // Clear admin-specific items to avoid confusion
        if (data.users.admin) {
          data.users.admin.items = [];
        }
      }
    } else {
      if ("settings" in body) {
        data.users[user].settings = { ...data.users[user].settings, ...body.settings };
      }
      if ("items" in body) {
        const commonItems = data.common?.items || [];
        const commonItemsMap = new Map(commonItems.map(item => [item.id, item]));
        const userItemsToSave: AppLink[] = [];

        for (const item of body.items) {
          const commonItem = commonItemsMap.get(item.id);
          if (!commonItem) {
            // It's a new item created by the user
            userItemsToSave.push(item);
          } else {
            // It's a potentially modified common item.
            // Using simple inequality for comparison as object references will differ.
            if (JSON.stringify(item) !== JSON.stringify(commonItem)) {
              userItemsToSave.push(item);
            }
          }
        }
        data.users[user].items = userItemsToSave;
      }
    }

    await writeDataFile(data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "failed to save", details: error }, { status: 500 });
  } finally {
    fileMutex.release();
  }
}
