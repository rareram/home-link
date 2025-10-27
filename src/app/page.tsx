"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/* -------------------- Helpers -------------------- */
function uuid() {
  const g = (typeof globalThis !== "undefined") ? (globalThis as any) : (typeof window !== "undefined" ? (window as any) : {});
  const c = g.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* -------------------- Types -------------------- */
type HealthMethod = "HEAD" | "GET";
type HealthState = { status: "up" | "warn" | "down" | "unknown"; code?: number; ms?: number };

type AppLink = {
  id: string;
  name: string;
  url: string;
  gitUrl?: string;
  description?: string;
  detailsMd?: string;          // Markdown
  logoUrl?: string;            // http(s) or data URL
  certRenewalDate?: string;    // YYYY-MM-DD
  tokenExpiryDate?: string;    // YYYY-MM-DD
  pinned?: boolean;            // 상단 고정
  favorite?: boolean;          // 즐겨찾기

  healthUrl?: string;          // 설정된 경우에만 헬스체크 활성
  healthMethod?: HealthMethod;
  healthOkMin?: number;
};

type ThemeId = "classic" | "ocean" | "carbon" | "sunset";
type SortMode = "urgency" | "alpha_asc" | "alpha_desc" | "pinned_fav_urgency";
type OpenMode = "new_tab" | "same_tab";

type Settings = {
  siteTitle: string;
  siteSubtitle: string;    // 서브타이틀
  siteLogo?: string;       // data URL
  theme: ThemeId;
  sortMode: SortMode;
  openMode: OpenMode;
  adminMode: boolean;
  healthEnabled: boolean;
  healthIntervalSec: number;
  healthShowMs: boolean;
};

/* -------------------- Local Storage -------------------- */
const LS_KEY = "appLinksV4";
const SETTINGS_KEY = "homeLinksSettingsV4";

const loadItems = (): AppLink[] => {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
};
const saveItems = (items: AppLink[]) => localStorage.setItem(LS_KEY, JSON.stringify(items));

const DEFAULT_SETTINGS: Settings = {
  siteTitle: "홈링크웹",
  siteSubtitle: "런처 중심 · 소스위치 · 만료 카운트",
  theme: "classic",
  sortMode: "urgency",
  openMode: "new_tab",
  adminMode: true,
  healthEnabled: true,
  healthIntervalSec: 30,
  healthShowMs: true,
};
const loadSettings = (): Settings => {
  try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS; }
  catch { return DEFAULT_SETTINGS; }
};
const saveSettings = (s: Settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

/* -------------------- Utils -------------------- */
const daysLeft = (iso?: string) => {
  if (!iso) return undefined;
  const target = new Date(iso + "T00:00:00");
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
const urgencyBadge = (days?: number, label?: string) => {
  if (days === undefined) return null;
  const variant = days <= 7 ? "destructive" : days <= 30 ? "secondary" : "outline";
  const text = `${label ?? "D"}${days >= 0 ? "-" + days : "+" + Math.abs(days)}`;
  return <Badge variant={variant as any} className="text-xs">{text}</Badge>;
};
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* -------------------- Theme -------------------- */
const THEME_STYLES: Record<ThemeId, { page: string; card: string; hover: string; }> = {
  classic: {
    page: "bg-gradient-to-br from-white to-slate-50",
    card: "bg-white border border-slate-200",
    hover: "hover:shadow-lg hover:-translate-y-0.5 hover:ring-1 hover:ring-slate-200",
  },
  ocean: {
    page: "bg-gradient-to-br from-sky-50 to-indigo-50",
    card: "bg-white/90 backdrop-blur border border-sky-100",
    hover: "hover:shadow-xl hover:-translate-y-1 hover:ring-1 hover:ring-sky-200",
  },
  carbon: {
    page: "bg-gradient-to-br from-zinc-900 to-neutral-900",
    card: "bg-neutral-900 border border-neutral-700 text-neutral-100",
    hover: "hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:-translate-y-1 hover:ring-1 hover:ring-neutral-700",
  },
  sunset: {
    page: "bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50",
    card: "bg-white/90 backdrop-blur border border-rose-100",
    hover: "hover:shadow-xl hover:-translate-y-1 hover:ring-1 hover:ring-rose-200",
  },
};

/* -------------------- Health Check Hook -------------------- */
function useHealth(url?: string, method: HealthMethod = "HEAD", okMin = 200, enabled = true, intervalSec = 30) {
  const [state, setState] = useState<HealthState>({ status: "unknown" });

  useEffect(() => {
    if (!enabled || !url) { setState({ status: "unknown" }); return; }
    let timer: any; let aborted = false;

    const run = async () => {
      try {
        const start = performance.now();
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), Math.min(intervalSec * 1000, 10000));
        const res = await fetch(url, { method, signal: ctrl.signal, cache: "no-store", redirect: "follow" });
        clearTimeout(to);
        const ms = Math.round(performance.now() - start);
        const code = res.status;
        let status: HealthState["status"] = "down";
        if (code >= okMin && code < 300) status = "up";
        else if (code >= 300 && code < 400) status = "warn"; // 3xx 리다이렉트는 warn
        if (!aborted) setState({ status, code, ms });
      } catch {
        if (!aborted) setState({ status: "down" });
      }
    };

    run();
    timer = setInterval(run, Math.max(5, intervalSec) * 1000);
    return () => { aborted = true; if (timer) clearInterval(timer); };
  }, [url, method, okMin, enabled, intervalSec]);

  return state;
}

/* -------------------- App Form (Add/Edit) -------------------- */
function AppForm({
  initial,
  onSubmit,
  trigger,
  defaultOpen,
}: {
  initial?: Partial<AppLink>;
  onSubmit: (v: AppLink) => void;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [form, setForm] = useState<AppLink>({
    id: initial?.id ?? uuid(),
    name: initial?.name ?? "",
    url: initial?.url ?? "",
    gitUrl: initial?.gitUrl ?? "",
    description: initial?.description ?? "",
    detailsMd: initial?.detailsMd ?? "",
    logoUrl: initial?.logoUrl ?? "",
    certRenewalDate: initial?.certRenewalDate ?? "",
    tokenExpiryDate: initial?.tokenExpiryDate ?? "",
    pinned: initial?.pinned ?? false,
    favorite: initial?.favorite ?? false,

    healthUrl: initial?.healthUrl ?? "",
    healthMethod: initial?.healthMethod ?? "HEAD",
    healthOkMin: initial?.healthOkMin ?? 200,
  });

  useEffect(() => {
    if (open) {
      setForm({
        id: initial?.id ?? uuid(),
        name: initial?.name ?? "",
        url: initial?.url ?? "",
        gitUrl: initial?.gitUrl ?? "",
        description: initial?.description ?? "",
        detailsMd: initial?.detailsMd ?? "",
        logoUrl: initial?.logoUrl ?? "",
        certRenewalDate: initial?.certRenewalDate ?? "",
        tokenExpiryDate: initial?.tokenExpiryDate ?? "",
        pinned: initial?.pinned ?? false,
        favorite: initial?.favorite ?? false,
        healthUrl: initial?.healthUrl ?? "",
        healthMethod: initial?.healthMethod ?? "HEAD",
        healthOkMin: initial?.healthOkMin ?? 200,
      });
    }
  }, [initial, open]);

  const handleFile = async (f?: File | null) => {
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setForm((p) => ({ ...p, logoUrl: dataUrl }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" className="gap-2"><Lucide.Plus className="w-4 h-4" />추가</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-[780px]">
        <DialogHeader><DialogTitle>{initial?.id ? "앱 편집" : "앱 추가"}</DialogTitle></DialogHeader>

        <Tabs defaultValue="basic" className="mt-2">
          <TabsList>
            <TabsTrigger value="basic">기본</TabsTrigger>
            <TabsTrigger value="details">상세설명(Markdown)</TabsTrigger>
            <TabsTrigger value="health">헬스체크</TabsTrigger>
          </TabsList>

          {/* 기본 */}
          <TabsContent value="basic" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: Grafana" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git">소스(Git) URL</Label>
                <Input id="git" value={form.gitUrl} onChange={(e) => setForm({ ...form, gitUrl: e.target.value })} placeholder="https://gitlab/... 또는 https://github.com/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">로고 (URL 또는 파일)</Label>
                <div className="flex gap-2">
                  <Input id="logo" value={form.logoUrl ?? ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="로고 이미지 URL" />
                  <label className="inline-flex items-center px-3 h-9 whitespace-nowrap border rounded-md cursor-pointer">
                    <Lucide.Upload className="w-4 h-4 mr-2" />업로드
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="desc">간단한 설명</Label>
                <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="한 줄 소개" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert">인증서 갱신일</Label>
                <Input id="cert" type="date" value={form.certRenewalDate ?? ""} onChange={(e) => setForm({ ...form, certRenewalDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">토큰 만료일</Label>
                <Input id="token" type="date" value={form.tokenExpiryDate ?? ""} onChange={(e) => setForm({ ...form, tokenExpiryDate: e.target.value })} />
              </div>
              <div className="flex items-center gap-4 sm:col-span-2 pt-2">
                <div className="flex items-center gap-3"><Switch checked={!!form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} /><Label>상단 고정</Label></div>
                <div className="flex items-center gap-3"><Switch checked={!!form.favorite} onCheckedChange={(v) => setForm({ ...form, favorite: v })} /><Label>즐겨찾기</Label></div>
              </div>
            </div>
          </TabsContent>

          {/* 상세설명 */}
          <TabsContent value="details" className="mt-4">
            <div className="space-y-2">
              <Label htmlFor="detailsMd">상세설명 (Markdown)</Label>
              <Textarea id="detailsMd" rows={10} value={form.detailsMd} onChange={(e) => setForm({ ...form, detailsMd: e.target.value })} placeholder={`# 다이어그램/설명\n- 서비스 구성\n- 점검 체크리스트\n- API 링크`} />
            </div>
          </TabsContent>

          {/* 헬스체크 */}
          <TabsContent value="health" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hurl">헬스체크 URL (설정 시에만 활성)</Label>
                <Input id="hurl" value={form.healthUrl ?? ""} onChange={(e) => setForm({ ...form, healthUrl: e.target.value })} placeholder="https://.../healthz" />
              </div>
              <div className="space-y-2">
                <Label>메서드</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{form.healthMethod}<Lucide.ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(["HEAD", "GET"] as HealthMethod[]).map(m => <DropdownMenuItem key={m} onClick={() => setForm({ ...form, healthMethod: m })}>{m}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <Label htmlFor="okmin">정상 최소 코드(이상)</Label>
                <Input id="okmin" type="number" min={100} max={600} value={form.healthOkMin ?? 200} onChange={(e) => setForm({ ...form, healthOkMin: Number(e.target.value || 200) })} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button onClick={() => { onSubmit(form); setOpen(false); }} className="gap-2"><Lucide.Save className="w-4 h-4" />저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- App Card (Launcher) -------------------- */
function AppCard({
  item, theme, openMode, adminMode,
  settingsHealth, onEdit, onDelete, onToggleFavorite, onTogglePinned,
}: {
  item: AppLink;
  theme: ThemeId;
  openMode: OpenMode;
  adminMode: boolean;
  settingsHealth: { enabled: boolean; intervalSec: number; showMs: boolean };
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
}) {
  const dCert = daysLeft(item.certRenewalDate);
  const dTok = daysLeft(item.tokenExpiryDate);

  // 헬스체크: healthUrl이 설정된 경우에만 활성
  const hasHealth = !!(item.healthUrl && item.healthUrl.trim());
  const health = useHealth(
    hasHealth ? item.healthUrl : undefined,
    item.healthMethod ?? "HEAD",
    item.healthOkMin ?? 200,
    settingsHealth.enabled && hasHealth,
    settingsHealth.intervalSec
  );

  const openLink = () => {
    if (openMode === "same_tab") window.location.href = item.url;
    else window.open(item.url, "_blank");
  };

  const healthDot = (() => {
    const base = "inline-block w-2.5 h-2.5 rounded-full";
    if (!settingsHealth.enabled || !hasHealth) return <span className={`${base} bg-neutral-300`} title="INACTIVE" />;
    if (health.status === "up")   return <span className={`${base} bg-emerald-500`} title={`UP${health.code ? ` ${health.code}` : ""}${health.ms ? ` · ${health.ms}ms` : ""}`} />;
    if (health.status === "warn") return <span className={`${base} bg-amber-500`}  title={`WARN${health.code ? ` ${health.code}` : ""}${health.ms ? ` · ${health.ms}ms` : ""}`} />;
    if (health.status === "down") return <span className={`${base} bg-red-500`}    title={`DOWN${health.code ? ` ${health.code}` : ""}`} />;
    return <span className={`${base} bg-neutral-300`} title="UNKNOWN" />;
  })();

  return (
    <Card
      onClick={openLink}
      className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 ${THEME_STYLES[theme].card} ${THEME_STYLES[theme].hover}`}
    >
      {/* 즐겨찾기 바: 기본 회색, 즐겨찾기면 주황 */}
      <div className={`absolute inset-x-0 top-0 h-1 ${item.favorite ? 'bg-amber-500/90' : 'bg-neutral-300/80'}`} />

      {/* 우상단: 즐겨찾기 별 + PIN 토글 */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button
          aria-label="즐겨찾기"
          className="p-1 rounded-md bg-white/80 dark:bg-black/30 backdrop-blur hover:scale-110 transition"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          title={item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          {item.favorite
            ? <Lucide.Star className="w-4 h-4 text-amber-500" />
            : <Lucide.StarOff className="w-4 h-4 text-neutral-400" />}
        </button>

        <button
          aria-label="상단 고정"
          className="p-1 rounded-md bg-white/80 dark:bg-black/30 backdrop-blur hover:scale-110 transition"
          onClick={(e) => { e.stopPropagation(); onTogglePinned(); }}
          title={item.pinned ? "상단 고정 해제" : "상단 고정"}
        >
          {item.pinned
            ? <Lucide.Pin className="w-4 h-4 text-sky-500" />
            : <Lucide.PinOff className="w-4 h-4 text-neutral-400" />}
        </button>
      </div>

      {/* 본문: 푸터와 겹치지 않도록 하단 패딩 충분히 확보 */}
      <CardContent className="px-4 pt-4 pb-14">
        <div className="flex items-start gap-3">
          {/* 로고 */}
          <div className="w-20 h-20 shrink-0 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
            {item.logoUrl ? (<img src={item.logoUrl} alt={item.name} className="w-[72px] h-[72px] object-contain" />) : (<Lucide.Image className="w-9 h-9 opacity-50" />)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate" title={item.name}>{item.name}</h3>
              {item.gitUrl && (
                <button
                  aria-label="소스 저장소"
                  className="ml-1 p-1 rounded hover:bg-muted"
                  onClick={(e)=>{ e.stopPropagation(); window.open(item.gitUrl!, '_blank'); }}
                  title="소스 저장소 열기"
                >
                  <Lucide.Github className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5" title={item.description}>{item.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {urgencyBadge(dCert, "Cert D")}
              {urgencyBadge(dTok, "Token D")}
            </div>
          </div>
        </div>
      </CardContent>

      {/* 고정 푸터: 항상 카드 하단 같은 라인에 위치 (헬스·정보·더보기) */}
      <div className="pointer-events-none absolute left-4 right-4 bottom-3 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-1">
          {healthDot}
          {/* 필요 시 ms 배지 */}
          {settingsHealth.showMs && hasHealth && (health.ms !== undefined) && (
            <span className="text-[10px] px-1 py-0.5 border rounded bg-white/70 dark:bg-black/30 backdrop-blur">{health.ms}ms</span>
          )}
        </div>

        {adminMode && (
          <div className="pointer-events-auto flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={(e) => e.stopPropagation()} aria-label="상세보기">
                  <Lucide.Info className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[860px]" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {item.logoUrl ? <img src={item.logoUrl} alt="" className="w-6 h-6 object-contain" /> : <Lucide.Image className="w-5 h-5" />}
                    {item.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <a href={item.url} target="_blank" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 underline">
                      <Lucide.SquareArrowOutUpRight className="w-4 h-4" />새 창으로 열기
                    </a>
                    <a href={item.url} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 underline">
                      <Lucide.ExternalLink className="w-4 h-4" />현재 탭에서 열기
                    </a>
                    {item.gitUrl && (
                      <a href={item.gitUrl} target="_blank" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 underline">
                        <Lucide.Github className="w-4 h-4" />소스
                      </a>
                    )}
                    {urgencyBadge(dCert, "Cert D")}
                    {urgencyBadge(dTok, "Token D")}
                    <span className="inline-flex items-center gap-1">
                      {healthDot}
                      {settingsHealth.showMs && hasHealth && (health.ms !== undefined) && (
                        <span className="text-[10px] px-1 py-0.5 border rounded">{health.ms}ms</span>
                      )}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{item.detailsMd || "_상세설명이 없습니다._"}</ReactMarkdown>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={(e) => e.stopPropagation()} aria-label="더보기">
                  <Lucide.ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.url)} className="gap-2">
                  <Lucide.Link className="w-4 h-4" />URL 복사
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit} className="gap-2">
                  <Lucide.Edit className="w-4 h-4" />편집
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-600">
                  <Lucide.AlertCircle className="w-4 h-4" />삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </Card>
  );
}

/* -------------------- Settings Dialog -------------------- */
function SettingsDialog({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Settings>(settings);
  useEffect(() => setForm(settings), [settings, open]);

  const handleLogo = async (f?: File | null) => {
    if (!f) return;
    const data = await fileToDataUrl(f);
    setForm((p) => ({ ...p, siteLogo: data }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><Lucide.Settings className="w-4 h-4" />설정</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader><DialogTitle>전체 설정</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">웹페이지 제목</Label>
            <Input id="title" value={form.siteTitle} onChange={(e) => setForm({ ...form, siteTitle: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">서브타이틀</Label>
            <Input id="subtitle" value={form.siteSubtitle} onChange={(e) => setForm({ ...form, siteSubtitle: e.target.value })} placeholder="예: 런처 중심 · 소스위치 · 만료 카운트" />
          </div>
          <div className="space-y-2">
            <Label>회사 로고</Label>
            <div className="flex items-center gap-3">
              <div className="w-[50px] h-[50px] rounded bg-muted overflow-hidden flex items-center justify-center">
                {form.siteLogo ? <img src={form.siteLogo} className="w-[50px] h-[50px] object-contain" /> : <Lucide.Image className="w-5 h-5 opacity-50" />}
              </div>
              <label className="inline-flex items-center px-3 h-9 whitespace-nowrap border rounded-md cursor-pointer text-sm">
                <Lucide.Upload className="w-4 h-4 mr-2" />업로드
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>테마</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{form.theme}<Lucide.ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(["classic", "ocean", "carbon", "sunset"] as ThemeId[]).map(t => (
                  <DropdownMenuItem key={t} onClick={() => setForm({ ...form, theme: t })}>{t}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>정렬</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{form.sortMode}<Lucide.ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(["urgency", "alpha_asc", "alpha_desc", "pinned_fav_urgency"] as SortMode[]).map(s => (
                  <DropdownMenuItem key={s} onClick={() => setForm({ ...form, sortMode: s })}>{s}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>열기 방식</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{form.openMode === "new_tab" ? "새 창" : "현재 창"}<Lucide.ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setForm({ ...form, openMode: "new_tab" })}>새 창</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setForm({ ...form, openMode: "same_tab" })}>현재 창</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>관리자 모드</Label>
            <div className="flex items-center gap-2">
              <Switch checked={form.adminMode} onCheckedChange={(v) => setForm({ ...form, adminMode: v })} />
              <span className="text-sm">관리 아이콘 표시</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>헬스체크</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={form.healthEnabled} onCheckedChange={(v) => setForm({ ...form, healthEnabled: v })} />
                <span className="text-sm">사용</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">주기</span>
                <Input type="number" className="w-20" min={5} max={600} value={form.healthIntervalSec} onChange={(e) => setForm({ ...form, healthIntervalSec: Number(e.target.value || 30) })} />
                <span className="text-sm">초</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.healthShowMs} onCheckedChange={(v) => setForm({ ...form, healthShowMs: v })} />
                <span className="text-sm">응답시간(ms) 배지</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button className="gap-2" onClick={() => { onSave(form); setOpen(false); }}><Lucide.Save className="w-4 h-4" />저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Main Page -------------------- */
export default function Page() {
  const [items, setItems] = useState<AppLink[]>([]);
  const [query, setQuery] = useState("");
  const [showExpiredFirst, setShowExpiredFirst] = useState(true);
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // 파일 input 고유 id (불러오기 리셋을 위해)
  const [importInputId] = useState(() => `import-json-${uuid()}`);

  useEffect(() => {
    const loaded = loadItems();
    if (loaded.length > 0) setItems(loaded);
    else {
      const seed: AppLink[] = [
        {
          id: uuid(), name: "Grafana", url: "https://grafana.example.com",
          gitUrl: "https://gitlab.example.com/infra/grafana",
          description: "운영 대시보드",
          detailsMd: `# Grafana\n- 운영 현황 대시보드 링크 모음\n- 백업/업그레이드 체크리스트`,
          logoUrl: "https://raw.githubusercontent.com/grafana/grafana/main/public/img/grafana_icon.svg",
          certRenewalDate: "2026-01-31",
          tokenExpiryDate: "2025-12-15",
          pinned: true, favorite: true,
          healthMethod: "HEAD", healthOkMin: 200
        },
        {
          id: uuid(), name: "n8n", url: "https://n8n.example.com",
          gitUrl: "https://gitlab.example.com/ops/n8n",
          description: "워크플로 자동화",
          detailsMd: `웹훅 트리거, 팀즈 알림, 젠킨스 연동 예제`,
          logoUrl: "https://avatars.githubusercontent.com/u/45487711?s=200&v=4",
          certRenewalDate: "2025-11-20",
          tokenExpiryDate: "2025-12-10",
          healthMethod: "HEAD", healthOkMin: 200
        },
        {
          id: uuid(), name: "Dify", url: "https://dify.example.com",
          gitUrl: "https://gitlab.example.com/ai/dify",
          description: "AI 앱 빌더/에이전트",
          detailsMd: `문서/플러그인/빌더 가이드`,
          logoUrl: "https://raw.githubusercontent.com/langgenius/dify/HEAD/packages/web/public/logo.svg",
          certRenewalDate: "2026-03-10",
          healthMethod: "HEAD", healthOkMin: 200
        },
        {
          id: uuid(), name: "Ollama + OpenWebUI", url: "https://llm.example.com",
          gitUrl: "https://gitlab.example.com/ai/ollama-openwebui",
          description: "사내 LLM 웹 UI",
          detailsMd: `모델 카탈로그, 운영 팁, 컨테이너 재기동 체크리스트`,
          logoUrl: "https://raw.githubusercontent.com/open-webui/open-webui/main/static/favicon.png",
          tokenExpiryDate: "2025-12-05",
          pinned: true,
          healthMethod: "HEAD", healthOkMin: 200
        },
      ];
      setItems(seed);
      saveItems(seed);
    }
    setSettings(loadSettings());
  }, []);

  useEffect(() => saveItems(items), [items]);
  useEffect(() => saveSettings(settings), [settings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items.filter((it) =>
      (!q || [it.name, it.description, it.url, it.gitUrl].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) &&
      (!onlyFavorite || it.favorite)
    );

    const sortMode = settings.sortMode;
    const urgVal = (x: AppLink) => Math.min(x.certRenewalDate ? daysLeft(x.certRenewalDate)! : 9999, x.tokenExpiryDate ? daysLeft(x.tokenExpiryDate)! : 9999);
    arr = arr.sort((a, b) => {
      if (sortMode === "alpha_asc") return a.name.localeCompare(b.name);
      if (sortMode === "alpha_desc") return b.name.localeCompare(a.name);
      if (sortMode === "pinned_fav_urgency") {
        const pa = (a.pinned ? 1 : 0) + (a.favorite ? 1 : 0);
        const pb = (b.pinned ? 1 : 0) + (b.favorite ? 1 : 0);
        if (pa !== pb) return pb - pa;
        return urgVal(a) - urgVal(b);
      }
      const base = urgVal(a) - urgVal(b);
      return showExpiredFirst ? base : -base;
    });

    return arr;
  }, [items, query, showExpiredFirst, onlyFavorite, settings.sortMode]);

  const upsert = (v: AppLink) => setItems((prev) => {
    const idx = prev.findIndex((p) => p.id === v.id);
    return idx >= 0 ? [...prev.slice(0, idx), v, ...prev.slice(idx + 1)] : [v, ...prev];
  });
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const [editing, setEditing] = useState<AppLink | null>(null);

  // 내보내기: items + settings를 함께 저장(호환)
  const doExport = () => {
    const payload = { version: 1, items, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "home-links.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 불러오기: 배열/객체 모두 호환, input value 리셋 포함
  const onImport = async (file?: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed)) {
        setItems(parsed as AppLink[]);
      } else if (parsed && typeof parsed === "object") {
        const maybeItems = Array.isArray(parsed.items) ? parsed.items as AppLink[] : [];
        const maybeSettings = parsed.settings && typeof parsed.settings === "object" ? { ...DEFAULT_SETTINGS, ...parsed.settings } as Settings : null;

        if (maybeItems.length > 0) setItems(maybeItems);
        if (maybeSettings) setSettings(maybeSettings);
      } else {
        alert("알 수 없는 JSON 형식입니다.");
      }
    } catch (e) {
      console.error(e);
      alert("JSON 파싱 중 오류가 발생했습니다.");
    } finally {
      const el = document.getElementById(importInputId) as HTMLInputElement | null;
      if (el) el.value = "";
    }
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 lg:p-10 ${THEME_STYLES[settings.theme].page}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[50px] h-[50px] rounded bg-muted overflow-hidden flex items-center justify-center">
              {settings.siteLogo ? <img src={settings.siteLogo} className="w-[50px] h-[50px] object-contain" /> : <Lucide.Image className="w-5 h-5 opacity-50" />}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{settings.siteTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{settings.siteSubtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* 검색 */}
            <div className="relative">
              <Lucide.Search className="w-4 h-4 absolute left-2 top-2.5" />
              <Input className="pl-8 w-56" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <SettingsDialog settings={settings} onSave={(s) => setSettings(s)} />

            <AppForm onSubmit={upsert} />
            <Button variant="outline" onClick={doExport} className="gap-2 h-9">
              <Lucide.Save className="w-4 h-4" />내보내기
            </Button>
            <label htmlFor={importInputId}>
              <Button variant="outline" className="gap-2 h-9"><Lucide.Upload className="w-4 h-4" />불러오기</Button>
            </label>
            <input
              id={importInputId}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-2"><Switch checked={showExpiredFirst} onCheckedChange={setShowExpiredFirst} /><span className="text-sm">만료 임박 우선 정렬 (토글)</span></div>
          <div className="flex items-center gap-2"><Switch checked={onlyFavorite} onCheckedChange={setOnlyFavorite} /><span className="text-sm">즐겨찾기만 보기</span></div>
          <div className="text-xs text-muted-foreground">
            정렬: <span className="font-medium">{settings.sortMode}</span> · 열기: <span className="font-medium">{settings.openMode === "new_tab" ? "새 창" : "현재 창"}</span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-6">
          {filtered.map((it) => (
            <AppCard
              key={it.id}
              item={it}
              theme={settings.theme}
              openMode={settings.openMode}
              adminMode={settings.adminMode}
              settingsHealth={{ enabled: settings.healthEnabled, intervalSec: settings.healthIntervalSec, showMs: settings.healthShowMs }}
              onToggleFavorite={() => setItems((prev) => prev.map(p => p.id === it.id ? { ...p, favorite: !p.favorite } : p))}
              onTogglePinned={() => setItems((prev) => prev.map(p => p.id === it.id ? { ...p, pinned: !p.pinned } : p))}
              onEdit={() => setEditing(it)}
              onDelete={() => remove(it.id)}
            />
          ))}
        </div>
      </div>

      {/* Global Editor */}
      {editing && <AppForm initial={editing} defaultOpen onSubmit={(v) => { upsert(v); setEditing(null); }} trigger={<span />} />}
    </div>
  );
}

