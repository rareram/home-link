"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { UserProfile } from "@/components/user-profile";

/* -------------------- Helpers -------------------- */
function uuid() {
  const g: any = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});
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
  siteUrl?: string;
  docUrl?: string;
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
  isPublic?: boolean;
};


type SortMode = "urgency" | "alpha_asc" | "alpha_desc" | "pinned_fav_urgency";
type OpenMode = "new_tab" | "same_tab";

type Settings = {
  siteTitle: string;
  siteSubtitle: string;
  siteLogo?: string;
  siteBackgroundUrl?: string;
  sortMode: SortMode;
  openMode: OpenMode;
  adminMode: boolean;
  healthEnabled: boolean;
  healthIntervalSec: number;
  healthShowMs: boolean;
  colors?: { star?: string; favBar?: string; pin?: string; pinBg?: string };
};

// API response payload for GET
type GetPayload = { items: AppLink[]; settings: Settings; globalSettings: Settings };


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

/* -------------------- Health Hook -------------------- */
function useHealth(url?: string, method: HealthMethod = "HEAD", okMin = 200, enabled = true, intervalSec = 30) {
  const [state, setState] = useState<HealthState>({ status: "unknown" });
  useEffect(() => {
    if (!enabled || !url) { setState({ status: "unknown" }); return; }
    let timer: any; let aborted = false;

    const run = async () => {
      let healthUrl = url;
      // If it's an absolute URL, use the proxy
      if (url.startsWith('http')) {
        healthUrl = `/api/health-proxy?url=${encodeURIComponent(url)}&method=${method}`;
      }

      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), Math.min(intervalSec * 1000, 10000));
        // The request to our own server is always GET
        const res = await fetch(healthUrl, { signal: ctrl.signal, cache: "no-store" });
        clearTimeout(to);

        if (!res.ok) {
          if (!aborted) setState({ status: "down" });
          return;
        }

        const data = await res.json();
        const code = data.status;
        const ms = data.ms;
        let status: HealthState["status"] = "down";
        if (code >= okMin && code < 300) status = "up";
        else if (code >= 300 && code < 400) status = "warn";
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

/* -------------------- Upload helper -------------------- */
async function uploadLogo(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("filename", file.name);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  const data = await res.json();
  return data.url as string;
}

/* -------------------- App Form -------------------- */
function AppForm({
  initial, onSubmit, trigger, defaultOpen, userRole,
}: {
  initial?: Partial<AppLink>;
  onSubmit: (v: AppLink) => void;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  userRole: "admin" | "user";
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [form, setForm] = useState<AppLink>(() => ({
    id: initial?.id ?? uuid(),
    name: initial?.name ?? "",
    url: initial?.url ?? "",
    gitUrl: initial?.gitUrl ?? "",
    siteUrl: initial?.siteUrl ?? "",
    docUrl: initial?.docUrl ?? "",
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
    tags: initial?.tags ?? [],
    isPublic: initial?.isPublic ?? (userRole === 'admin'),
  }));
  // 태그 입력 UX: text로 입력받고 저장 시 파싱
  const [tagsText, setTagsText] = useState<string>((initial?.tags ?? []).join(", "));

  useEffect(() => {
    if (open) {
      setForm({
        id: initial?.id ?? uuid(),
        name: initial?.name ?? "",
        url: initial?.url ?? "",
        gitUrl: initial?.gitUrl ?? "",
        siteUrl: initial?.siteUrl ?? "",
        docUrl: initial?.docUrl ?? "",
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
        tags: initial?.tags ?? [],
      });
      setTagsText((initial?.tags ?? []).join(", "));
    }
  }, [initial, open]);

  const handleFile = async (f?: File | null) => {
    if (!f) return;
    try {
      const url = await uploadLogo(f);
      setForm((p) => ({ ...p, logoUrl: url }));
    } catch { alert("로고 업로드 실패"); }
  };

  const handleSave = () => {
    const tags = tagsText.split(",").map(s => s.trim()).filter(Boolean);
    onSubmit({ ...form, tags });
    setOpen(false);
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
                <Label htmlFor="site">웹사이트 URL</Label>
                <Input id="site" value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc">문서 URL</Label>
                <Input id="doc" value={form.docUrl} onChange={(e) => setForm({ ...form, docUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">로고 (URL 또는 파일)</Label>
                <div className="flex gap-2">
                  <Input id="logo" value={form.logoUrl ?? ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="/uploads/... 또는 https://..." />
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tags">태그 (쉼표 구분)</Label>
                <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="예: monitoring, ops, dashboard" />
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

          <TabsContent value="details" className="mt-4">
            <div className="space-y-2">
              <Label htmlFor="detailsMd">상세설명 (Markdown)</Label>
              <Textarea id="detailsMd" rows={10} value={form.detailsMd} onChange={(e) => setForm({ ...form, detailsMd: e.target.value })} placeholder={`# 다이어그램/설명\n- 서비스 구성\n- 점검 체크리스트\n- API 링크`} />
            </div>
          </TabsContent>

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
          <Button onClick={handleSave} className="gap-2"><Lucide.Save className="w-4 h-4" />저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- App Card -------------------- */
function AppCard({
  item, openMode, adminMode, userRole,
  settingsHealth, onEdit, onDelete, onToggleFavorite, onTogglePinned, colors,
}: {
  item: AppLink;
  openMode: OpenMode;
  adminMode: boolean;
  userRole: "admin" | "user";
  settingsHealth: { enabled: boolean; intervalSec: number; showMs: boolean };
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
  colors: { star: string; favBar: string; pin: string; pinBg: string };
}) {
  const dCert = daysLeft(item.certRenewalDate);
  const dTok = daysLeft(item.tokenExpiryDate);

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

  const pinnedHighlight = item.pinned ? "ring-1 ring-sky-200/50" : "";

  return (
    <Card
      onClick={openLink}
      className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${pinnedHighlight}`}
      style={{ "--pin-bg-color": colors.pinBg } as React.CSSProperties}
    >
      {/* 상단 바 */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: item.favorite ? colors.favBar : "rgba(120,120,120,0.5)" }} />
      {/* 핀 하이라이트 배경 */}
      {item.pinned && <div className="pointer-events-none absolute inset-0 bg-[var(--pin-bg-color)]/40 dark:bg-[var(--pin-bg-color)]/5" />}

      <div className="isolate">
        {/* 우상단: 즐겨찾기 / PIN */}
        <div className="absolute right-2 top-2 flex items-center gap-1 z-10">
          <button aria-label="즐겨찾기" className="p-1 rounded-md bg-white/80 dark:bg-black/30 backdrop-blur hover:scale-110 transition"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            {item.favorite ? <Lucide.Star className="w-4 h-4" style={{ color: colors.star }} /> : <Lucide.StarOff className="w-4 h-4 text-neutral-400" />}
          </button>
          <button aria-label="상단 고정" className="p-1 rounded-md bg-white/80 dark:bg-black/30 backdrop-blur hover:scale-110 transition"
            onClick={(e) => { e.stopPropagation(); onTogglePinned(); }}>
            {item.pinned ? <Lucide.Pin className="w-4 h-4" style={{ color: colors.pin }} /> : <Lucide.PinOff className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>

        {/* 본문: 하단 고정 영역(태그 + 푸터) 공간 확보 */}
        <CardContent className="px-4 pt-4 pb-17">
          <div className="flex items-start gap-3 mb-1">
            <div className="w-16 h-16 shrink-0 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
              {item.logoUrl ? (<img src={item.logoUrl} alt={item.name} className="w-14 h-14 object-contain" />) : (<Lucide.Image className="w-8 h-8 opacity-50" />)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate" title={item.name}>{item.name}</h3>
                <div className="flex items-center flex-shrink-0">
                  {item.siteUrl && (
                    <button aria-label="웹사이트" className="p-1 rounded hover:bg-muted"
                      onClick={(e)=>{ e.stopPropagation(); window.open(item.siteUrl!, '_blank'); }}>
                      <Lucide.Globe className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.docUrl && (
                    <button aria-label="문서" className="p-1 rounded hover:bg-muted"
                      onClick={(e)=>{ e.stopPropagation(); window.open(item.docUrl!, '_blank'); }}>
                      <Lucide.BookText className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.gitUrl && (
                    <button aria-label="소스 저장소" className="p-1 rounded hover:bg-muted"
                      onClick={(e)=>{ e.stopPropagation(); window.open(item.gitUrl!, '_blank'); }}>
                      <Lucide.Github className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5" title={item.description}>{item.description}</p>

              {(dCert !== undefined || dTok !== undefined) && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {urgencyBadge(dCert, "Cert D")}
                  {urgencyBadge(dTok, "Token D")}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        {/* 하단 고정: 태그 라인 (항상 같은 위치) */}
        <div className="pointer-events-none absolute left-4 right-4 bottom-10 flex flex-wrap gap-1 min-h-[18px]">
          {(item.tags && item.tags.length > 0) && item.tags.map(t => (
            <span key={t} className="pointer-events-auto text-[10px] px-1.5 py-0.5 rounded border bg-white/70 dark:bg-black/30 backdrop-blur">#{t}</span>
          ))}
        </div>

        {/* 하단 고정: 헬스체크 / 정보 / 더보기 */}
        <div className="pointer-events-none absolute left-4 right-4 bottom-3 flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-1">
            {healthDot}
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
                      {item.siteUrl && (
                        <a href={item.siteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 underline">
                          <Lucide.Home className="w-4 h-4" />웹사이트
                        </a>
                      )}
                      {item.docUrl && (
                        <a href={item.docUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 underline">
                          <Lucide.Book className="w-4 h-4" />문서
                        </a>
                      )}
                      {item.gitUrl && (
                        <a href={item.gitUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 underline">
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
                  {(userRole === 'admin' || !item.isPublic) && (
                    <>
                      <DropdownMenuItem onClick={onEdit} className="gap-2">
                        <Lucide.Edit className="w-4 h-4" />편집
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-600">
                        <Lucide.AlertCircle className="w-4 h-4" />삭제
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
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
    try {
      const url = await uploadLogo(f);
      setForm((p) => ({ ...p, siteLogo: url }));
    } catch { alert("로고 업로드 실패"); }
  };

  const handleBackground = async (f?: File | null) => {
    if (!f) return;
    try {
      const url = await uploadLogo(f);
      setForm((p) => ({ ...p, siteBackgroundUrl: url }));
    } catch { alert("배경 업로드 실패"); }
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
            <Label>사이트 로고</Label>
            <div className="flex items-center gap-3">
              <SiteLogo src={form.siteLogo} />
              <label className="inline-flex items-center px-3 h-9 whitespace-nowrap border rounded-md cursor-pointer text-sm">
                <Lucide.Upload className="w-4 h-4 mr-2" />업로드
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setForm(p => ({...p, siteLogo: ""}))}>초기화</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>웹페이지 배경</Label>
            <div className="flex items-center gap-3">
              <div className="w-[50px] h-[50px] rounded bg-muted overflow-hidden flex items-center justify-center">
                {form.siteBackgroundUrl ? <img src={form.siteBackgroundUrl} className="w-[50px] h-[50px] object-contain" /> : <Lucide.Image className="w-5 h-5 opacity-50" />}
              </div>
              <label className="inline-flex items-center px-3 h-9 whitespace-nowrap border rounded-md cursor-pointer text-sm">
                <Lucide.Upload className="w-4 h-4 mr-2" />업로드
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBackground(e.target.files?.[0] ?? null)} />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setForm(p => ({...p, siteBackgroundUrl: ""}))}>초기화</Button>
            </div>
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
        </div>

        <div className="sm:col-span-2 border-t pt-3 mt-2">
          <Label className="block mb-2">아이콘/바 색상</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm w-24">즐겨찾기 별 :</span>
              <input type="color" value={form.colors?.star ?? "#f59e0b"}
                onChange={(e) => setForm(prev => ({ ...prev, colors: { ...prev.colors, star: e.target.value } }))}/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm w-24">상단 바 :</span>
              <input type="color" value={form.colors?.favBar ?? "#f59e0b"}
                onChange={(e) => setForm(prev => ({ ...prev, colors: { ...prev.colors, favBar: e.target.value } }))}/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm w-24">PIN 아이콘 :</span>
              <input type="color" value={form.colors?.pin ?? "#0ea5e9"}
                onChange={(e) => setForm(prev => ({ ...prev, colors: { ...prev.colors, pin: e.target.value } }))}/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm w-24">고정 배경 :</span>
              <input type="color" value={form.colors?.pinBg ?? "#f0f9ff"}
                onChange={(e) => setForm(prev => ({ ...prev, colors: { ...prev.colors, pinBg: e.target.value } }))}/>
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

const SiteLogo = ({ src }: { src?: string | null }) => {
  const containerClass = "w-[55px] h-[55px] rounded overflow-hidden flex items-center justify-center";
  const imgClass = "w-[55px] h-[55px] object-contain";
  const placeholder = <Lucide.Image className="w-5 h-5 opacity-50" />;
  return (
    <div className={containerClass}>
      {src ? <img src={src} className={imgClass} alt="Site Logo" /> : placeholder}
    </div>
  );
};

export default function Page() {
  const [items, setItems] = useState<AppLink[]>([]);
  const [settings, setSettings] = useState<Settings>({
    siteTitle: "홈링크웹",
    siteSubtitle: "런처 중심 · 소스위치 · 만료 카운트",
    sortMode: "alpha_asc",
    openMode: "new_tab",
    adminMode: true,
    healthEnabled: true,
    healthIntervalSec: 30,
    healthShowMs: true,
    colors: { star: "#f59e0b", favBar: "#f59e0b", pin: "#0ea5e9", pinBg: "#f0f9ff" },
  });
  const [globalSettings, setGlobalSettings] = useState<Settings>(settings);

  const [userRole, setUserRole] = useState("admin");

  const [query, setQuery] = useState("");
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [showExpiredFirst, setShowExpiredFirst] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppLink | null>(null);
  const isFirstLoad = useRef(true);

  // 서버에서 최초 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/data?user=${userRole}`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as GetPayload;
          setItems((data.items || []).map(item => ({ ...item, isPublic: item.isPublic ?? true })));
          if (isFirstLoad.current) {
            setGlobalSettings(data.globalSettings || {});
            setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
            isFirstLoad.current = false;
          }
        }
      } catch {}
    })();
  }, [userRole]);

  // 사용자 아이템 자동 저장 (debounce)
  useEffect(() => {
    if (isFirstLoad.current) return;
    const t = setTimeout(async () => {
      try {
        await fetch(`/api/data?user=${userRole}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          }
        );
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [items, userRole]);

  // 전체 설정 자동 저장 (debounce)
  useEffect(() => {
    if (isFirstLoad.current) return;
    const t = setTimeout(async () => {
      try {
        if (userRole === "admin") {
          await fetch(`/api/data?user=${userRole}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ settings }), // Send effective settings for admin to update global
            }
          );
        } else {
          // Calculate partial settings for user-specific overrides
          const partialSettings: Partial<Settings> = {};
          for (const key in settings) {
            // @ts-ignore
            if (settings[key] !== globalSettings[key]) {
              // @ts-ignore
              partialSettings[key] = settings[key];
            }
          }
          await fetch(`/api/data?user=${userRole}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ settings: partialSettings }), // Send only partial settings
            }
          );
        }
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [settings, globalSettings, userRole]);

  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap(i => i.tags ?? []))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items.filter((it) =>
      (!q || [it.name, it.description, it.url, it.gitUrl, ...(it.tags ?? [])]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))) &&
      (!onlyFavorite || it.favorite) &&
      (!selectedTag || (it.tags ?? []).includes(selectedTag))
    );

    const urgVal = (x: AppLink) =>
      Math.min(
        x.certRenewalDate ? daysLeft(x.certRenewalDate)! : 9999,
        x.tokenExpiryDate ? daysLeft(x.tokenExpiryDate)! : 9999
      );

    arr = arr.sort((a, b) => {
      // 핀 우선
      const pinA = a.pinned ? 1 : 0;
      const pinB = b.pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;

      const byNameAsc = a.name.localeCompare(b.name);
      const byNameDesc = -byNameAsc;

      if (settings.sortMode === "alpha_asc")  return byNameAsc;
      if (settings.sortMode === "alpha_desc") return byNameDesc;

      if (settings.sortMode === "pinned_fav_urgency") {
        const favA = a.favorite ? 1 : 0;
        const favB = b.favorite ? 1 : 0;
        if (favA !== favB) return favB - favA;
        const base = urgVal(a) - urgVal(b);
        return showExpiredFirst ? base : -base;
      }

      const base = urgVal(a) - urgVal(b);
      return showExpiredFirst ? base : -base;
    });

    return arr;
  }, [items, query, onlyFavorite, selectedTag, settings.sortMode, showExpiredFirst]);

  const upsert = (v: AppLink) => setItems((prev) => {
    const idx = prev.findIndex((p) => p.id === v.id);
    return idx >= 0 ? [...prev.slice(0, idx), v, ...prev.slice(idx + 1)] : [v, ...prev];
  });
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const doExport = () => {
    const payload = { version: 2, items, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `home-links-${userRole}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file?: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      const importedItems = parsed.items as AppLink[] | undefined;
      const importedSettings = parsed.settings as Settings | undefined;

      if (Array.isArray(importedItems)) {
        setItems(importedItems);
      }
      if (importedSettings && typeof importedSettings === 'object') {
        setSettings(s => ({...s, ...importedSettings}));
      }

      if (!Array.isArray(importedItems) && !(importedSettings && typeof importedSettings === 'object')) {
        alert("알 수 없는 JSON 형식입니다. 'items' 배열 또는 'settings' 객체를 포함해야 합니다.");
      }

    } catch {
      alert("JSON 파싱 중 오류가 발생했습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const pageStyle: React.CSSProperties = {};
  if (settings.siteBackgroundUrl) {
    pageStyle.backgroundImage = `url(${settings.siteBackgroundUrl})`;
    pageStyle.backgroundRepeat = "repeat";
    pageStyle.backgroundSize = "auto";
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-10" style={pageStyle}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => onImport(e.target.files?.[0])}
        className="hidden"
        accept=".json"
      />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <SiteLogo src={settings.siteLogo} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{settings.siteTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{settings.siteSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Lucide.Search className="w-4 h-4 absolute left-2 top-2.5" />
              <Input className="pl-8 w-56" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {/* 태그 필터 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9">
                  {selectedTag ?? "태그: 전체"} <Lucide.ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setSelectedTag(null)}>전체</DropdownMenuItem>
                {allTags.map(t => (
                  <DropdownMenuItem key={t} onClick={() => setSelectedTag(t)}>{t}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <AppForm onSubmit={upsert} userRole={userRole} />
            <UserProfile userRole={userRole} setUserRole={setUserRole} settings={settings} onSettingsSave={setSettings} onImport={() => fileInputRef.current?.click()} onExport={doExport} />
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
              openMode={settings.openMode}
              adminMode={settings.adminMode}
              userRole={userRole}
              settingsHealth={{ enabled: settings.healthEnabled, intervalSec: settings.healthIntervalSec, showMs: settings.healthShowMs }}
              colors={{
                star: settings.colors?.star ?? "#f59e0b",
                favBar: settings.colors?.favBar ?? "#f59e0b",
                pin: settings.colors?.pin ?? "#0ea5e9",
                pinBg: settings.colors?.pinBg ?? "#f0f9ff",
              }}
              onToggleFavorite={() => setItems((prev) => prev.map(p => p.id === it.id ? { ...p, favorite: !p.favorite } : p))}
              onTogglePinned={() => setItems((prev) => prev.map(p => p.id === it.id ? { ...p, pinned: !p.pinned } : p))}
              onEdit={() => setEditing(it)}
              onDelete={() => remove(it.id)}
            />
          ))}
        </div>
      </div>

      {/* Global Editor */}
      {editing && <AppForm initial={editing} userRole={userRole} defaultOpen onSubmit={(v) => { upsert(v); setEditing(null); }} trigger={<span />} />}
    </div>
  );
}
