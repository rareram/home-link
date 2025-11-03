"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Moon, Sun, LogOut, HelpCircle, Info, Send, Settings as SettingsIcon, FileUp, FileDown, UserCog, ShieldCheck, Plus, Upload, ChevronDown, Edit, AlertCircle, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import { version } from "../../package.json";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

// Types copied from page.tsx
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

// Helper function copied from page.tsx
async function uploadLogo(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("filename", file.name);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  const data = await res.json();
  return data.url as string;
}

// SettingsDialog component copied from page.tsx
function SettingsDialog({ settings, onSave, open, onOpenChange }: { settings: Settings; onSave: (s: Settings) => void, open: boolean, onOpenChange: (open: boolean) => void }) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader><DialogTitle>전체 설정</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
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
              <div className="w-[50px] h-[50px] rounded bg-muted overflow-hidden flex items-center justify-center">
                {form.siteLogo ? <img src={form.siteLogo} className="w-[50px] h-[50px] object-contain" /> : <ImageIcon className="w-5 h-5 opacity-50" />}
              </div>
              <label className="inline-flex items-center px-3 h-9 whitespace-nowrap border rounded-md cursor-pointer text-sm">
                <Upload className="w-4 h-4 mr-2" />업로드
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setForm(p => ({...p, siteLogo: ""}))}>초기화</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>웹페이지 배경</Label>
            <div className="flex items-center gap-3">
              <div className="w-[50px] h-[50px] rounded bg-muted overflow-hidden flex items-center justify-center">
                {form.siteBackgroundUrl ? <img src={form.siteBackgroundUrl} className="w-[50px] h-[50px] object-contain" /> : <ImageIcon className="w-5 h-5 opacity-50" />}
              </div>
              <label className="inline-flex items-center px-3 h-9 whitespace-nowrap border rounded-md cursor-pointer text-sm">
                <Upload className="w-4 h-4 mr-2" />업로드
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBackground(e.target.files?.[0] ?? null)} />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setForm(p => ({...p, siteBackgroundUrl: ""}))}>초기화</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>정렬</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{form.sortMode}<ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
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
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{form.openMode === "new_tab" ? "새 창" : "현재 창"}<ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
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
        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button className="gap-2" onClick={() => { onSave(form); onOpenChange(false); }}><SettingsIcon className="w-4 h-4" />저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// Mock user data, assuming the user is logged in and is an admin
const loggedInUser = {
  name: "Paul",
  role: "admin",
  image: "https://github.com/shadcn.png", // Example avatar
};

export function UserProfile({ userRole, setUserRole, settings, onSettingsSave }) {
  const { setTheme } = useTheme();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isAboutOpen, setAboutOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [helpContent, setHelpContent] = useState("");

  useEffect(() => {
    if (isHelpOpen) {
      fetch("/HELP.md")
        .then((res) => res.text())
        .then((text) => setHelpContent(text));
    }
  }, [isHelpOpen]);

  const handleRoleChange = () => {
    if (loggedInUser.role === 'admin') {
      const newRole = userRole === 'admin' ? 'user' : 'admin';
      setUserRole(newRole);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={loggedInUser.image} alt={`@${loggedInUser.name}`} />
              <AvatarFallback>{loggedInUser.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{loggedInUser.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {loggedInUser.role === 'admin' ? `Viewing as ${userRole}` : 'user'}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loggedInUser.role === 'admin' && (
            <>
              <DropdownMenuItem onClick={handleRoleChange}>
                {userRole === 'admin' ? <UserCog className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                <span>{userRole === 'admin' ? "Switch to User View" : "Switch to Admin View"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Global Settings</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 mr-2" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 mr-2" />
              <span>Toggle theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
             <FileDown className="mr-2 h-4 w-4" />
             <span>Import settings...</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
             <FileUp className="mr-2 h-4 w-4" />
             <span>Export settings...</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Info className="mr-2 h-4 w-4" />
            <span>About</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open("https://github.com/rareram/home-link/issues", "_blank")}>
            <Send className="mr-2 h-4 w-4" />
            <span>Feedback</span>
          </DropdownMenuItem>
          {/*
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
          */}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Help Dialog */}
      <Dialog open={isHelpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto">
            <ReactMarkdown>{helpContent}</ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>

      {/* About Dialog */}
      <Dialog open={isAboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>About Home-Link</DialogTitle>
            <DialogDescription>
              A personalized dashboard for all your links.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p>Version: 0.7.1</p>
            <p>Built with Next.js and shadcn/ui.</p>
            <p>Source Code: <a href="https://github.com/rareram/home-link" target="_blank" rel="noopener noreferrer" className="underline">github.com/rareram/home-link</a></p>
            <p>Author: rareram</p>
            <p>License: MIT License</p>
            <p>Feedback & Issues: <a href="https://github.com/rareram/home-link/issues" target="_blank" rel="noopener noreferrer" className="underline">GitHub Issues</a></p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAboutOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Settings Dialog */}
      {settings && <SettingsDialog settings={settings} onSave={onSettingsSave} open={isSettingsOpen} onOpenChange={setSettingsOpen} />}
    </>
  );
}
