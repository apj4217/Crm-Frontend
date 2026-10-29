import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, Building2, CalendarClock, ChartNoAxesCombined, ChevronDown, CircleHelp, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, Store, Target, Users, X, BriefcaseBusiness, MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "./lib/api";
import { useRemoteCollection, useRemoteValue } from "./hooks/useRemoteCollection";
import AuthScreen from "./components/AuthScreen";
import { Avatar, SearchInput } from "./components/UI";

const GeneralCRMPageRenderer = lazy(() => import("./components/GeneralCRMPageRenderer.jsx"));

const topNavItems = [
  { id: "Overview", label: "Overview" },
  { id: "Medicals", label: "Accounts" },
  { id: "Leads", label: "Leads" },
  { id: "Demos", label: "Meetings" },
  { id: "Trials", label: "Deals" },
  { id: "Follow-ups", label: "Follow-ups" },
  { id: "WhatsApp", label: "WhatsApp" },
  { id: "Activities", label: "Activities" },
  { id: "Reports", label: "Reports" },
  { id: "Team & Roles", label: "Team", adminOnly: true },
];

function App() {
  const [page, setPage] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [globalSearch, setGlobalSearch] = useState("");
  const [medicalSearchRequest, setMedicalSearchRequest] = useState({ term: "", key: 0 });
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authCheckSlow, setAuthCheckSlow] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const authenticated = Boolean(authUser && !authUser.mustChangePassword);
  const role = authUser?.role || "STAFF";
  const currentUser = authUser?.name || "";
  const medicalsResource = useRemoteCollection("medicals", authenticated);
  const demosResource = useRemoteCollection("demos", authenticated);
  const trialsResource = useRemoteCollection("trials", authenticated);
  const followUpsResource = useRemoteCollection("followUps", authenticated);
  const activitiesResource = useRemoteCollection("activities", authenticated);
  const teamResource = useRemoteCollection("users", authenticated && role !== "STAFF");
  const salesResource = useRemoteValue("/sales?limit=500", authenticated, []);
  const notificationsResource = useRemoteValue("/notifications?limit=50", authenticated, []);

  const medicals = medicalsResource.data;
  const setMedicals = medicalsResource.setData;
  const demos = demosResource.data;
  const setDemos = demosResource.setData;
  const trials = trialsResource.data;
  const setTrials = trialsResource.setData;
  const followUps = followUpsResource.data;
  const setFollowUps = followUpsResource.setData;
  const activityLogs = activitiesResource.data;
  const setActivityLogs = activitiesResource.setData;
  const team = role === "STAFF" ? [authUser].filter(Boolean) : teamResource.data;
  const sales = Array.isArray(salesResource.data) ? salesResource.data : [];
  const notifications = Array.isArray(notificationsResource.data) ? notificationsResource.data : [];
  const refreshAccountRelatedData = async () => Promise.allSettled([
    medicalsResource.refresh(), demosResource.refresh(), trialsResource.refresh(),
    followUpsResource.refresh(), activitiesResource.refresh(), salesResource.refresh(), notificationsResource.refresh()
  ]);

  useEffect(() => {
    let mounted = true;
    api.get("/auth/me").then((result) => { if (mounted) setAuthUser(result.user); })
      .catch((error) => { if (mounted && error.status !== 401) toast.error("Could not connect to CRM API", { description: error.message }); })
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthCheckSlow(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { setMobileNav(false); }, [page]);

  useEffect(() => {
    const syncSidebarForViewport = () => setDesktopCollapsed(window.matchMedia("(min-width: 1024px)").matches);
    window.addEventListener("resize", syncSidebarForViewport);
    return () => window.removeEventListener("resize", syncSidebarForViewport);
  }, []);

  const navigate = (target) => {
    if (target === "Team & Roles" && role === "STAFF") { toast.error("Staff cannot access team management."); return; }
    setPage(target); setMobileNav(false);
  };

  const onAuthenticated = (user) => {
    setAuthUser(user);
    if (!user.mustChangePassword) setPage("Overview");
  };

  const onLogout = async () => {
    try { await api.post("/auth/logout", {}); }
    catch (error) { toast.error("Logout request failed", { description: error.message }); }
    setAuthUser(null); setPage("Overview"); setGlobalSearch(""); setNotificationsOpen(false); setProfileOpen(false);
  };

  const onConvertTrial = async (trialId, conversion) => {
    try {
      const sale = await api.post(`/trials/${trialId}/convert`, { plan: conversion.plan, price: Number(conversion.price) || 0, reference: conversion.reference || "" });
      await Promise.all([trialsResource.refresh(), medicalsResource.refresh(), salesResource.refresh(), notificationsResource.refresh()]);
      toast.success("Deal marked as won", { description: `${sale.plan} · ₹${Number(sale.price || 0).toLocaleString("en-IN")}` });
      return sale;
    } catch (error) {
      toast.error("Could not close deal", { description: error.message });
      throw error;
    }
  };

  const markAllNotifications = async () => {
    try { await api.patch("/notifications/read-all", {}); await notificationsResource.refresh(); }
    catch (error) { toast.error("Could not update notifications", { description: error.message }); }
  };

  const markNotificationRead = async (notificationId) => {
    try { await api.patch(`/notifications/${notificationId}/read`, {}); await notificationsResource.refresh(); }
    catch (error) { toast.error("Could not update notification", { description: error.message }); }
  };

  const filteredSearch = globalSearch.trim().toLowerCase();
  const globalResults = useMemo(() => {
    if (!filteredSearch) return [];
    return medicals.filter((item) => `${item.medicalName} ${item.ownerName} ${item.phone} ${item.email} ${item.locality} ${item.city}`.toLowerCase().includes(filteredSearch))
      .slice(0, 8).map((item) => ({ type: "Account", title: item.medicalName, subtitle: `${item.ownerName} · ${item.locality || item.city || "Business"}`, id: item.id, record: item }));
  }, [filteredSearch, medicals]);

  const authQuery = new URLSearchParams(window.location.search);
  if (authLoading && !authCheckSlow && !authQuery.has("invite") && !authQuery.has("reset")) return <div className="app-shell flex min-h-screen items-center justify-center bg-[#f7f9fd]"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><div className="h-8 w-8 animate-pulse rounded-xl bg-violet-100"/><div><p className="text-sm font-bold text-slate-800">CRM</p><p className="mt-1 text-xs text-slate-500">Signing you in…</p></div></div></div>;
  if (authQuery.has("invite")) return <AuthScreen key="team-invitation" user={null} onAuthenticated={onAuthenticated}/>;
  if (authQuery.has("reset")) return <AuthScreen key="password-reset" user={null} onAuthenticated={onAuthenticated}/>;
  if (!authUser || authUser.mustChangePassword) return <AuthScreen key={authUser?.id || "login"} user={authUser} onAuthenticated={onAuthenticated}/>;

  return <div className="app-shell min-h-screen bg-[#f7f9fd] text-slate-800">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <Header globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} globalResults={globalResults} navigate={navigate} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} profileOpen={profileOpen} setProfileOpen={setProfileOpen} mobileNav={mobileNav} setMobileNav={setMobileNav} desktopCollapsed={desktopCollapsed} setDesktopCollapsed={setDesktopCollapsed} onSelectSearchResult={(result) => { setMedicalSearchRequest({ term: result.title, key: Date.now() }); setGlobalSearch(""); navigate("Medicals"); }} role={role} currentUser={currentUser} pageTitle={page} notifications={notifications} onMarkAllNotifications={markAllNotifications} onMarkNotificationRead={markNotificationRead} onLogout={onLogout}/>
    <main id="main-content" tabIndex={-1} className="atlas-main-content mx-auto max-w-[1512px] px-4 pb-10 pt-6 outline-none sm:px-6 lg:px-8 lg:pt-8">
      <div key={page} className="page-enter">
        {page === "Settings" ? (
          <SettingsPage user={authUser} onUserUpdated={setAuthUser}/>
        ) : (
          <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading workspace…</div>}>
            <GeneralCRMPageRenderer
              page={page}
              medicals={medicals} setMedicals={setMedicals}
              demos={demos} setDemos={setDemos}
              trials={trials} setTrials={setTrials}
              followUps={followUps} setFollowUps={setFollowUps}
              sales={sales} activities={activityLogs} setActivities={setActivityLogs}
              team={team} setTeam={teamResource.setData}
              role={role} currentUser={currentUser} currentUserId={authUser?.id}
              setPage={navigate} searchRequest={medicalSearchRequest}
              onAccountDeleted={refreshAccountRelatedData}
              onWorkflowChange={medicalsResource.refresh} onConvertTrial={onConvertTrial}
              activitiesLoading={activitiesResource.loading}
            />
          </Suspense>
        )}
      </div>
    </main>
    <footer className="mx-auto max-w-[1512px] px-4 pb-5 text-[11px] text-slate-400 sm:px-6 lg:px-8">CRM</footer>
  </div>;
}

function Header({ globalSearch, setGlobalSearch, globalResults, navigate, onSelectSearchResult, notificationsOpen, setNotificationsOpen, profileOpen, setProfileOpen, mobileNav, setMobileNav, desktopCollapsed, setDesktopCollapsed, role, currentUser, pageTitle, notifications, onMarkAllNotifications, onMarkNotificationRead, onLogout }) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const visibleNavItems = topNavItems.filter((item) => !item.adminOnly || role !== "STAFF");
  const primaryIds = new Set(["Overview", "Medicals", "Leads", "Trials", "Follow-ups", "WhatsApp"]);
  const primaryItems = visibleNavItems.filter((item) => primaryIds.has(item.id));
  const moreItems = visibleNavItems.filter((item) => !primaryIds.has(item.id));
  const navIcons = { Overview: LayoutDashboard, Medicals: Building2, Leads: Target, Trials: BriefcaseBusiness, "Follow-ups": CalendarClock, Demos: Users, Activities: Activity, Reports: ChartNoAxesCombined, "Team & Roles": ShieldCheck, WhatsApp: MessageCircle };

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) searchInputRef.current?.focus();
        else setMobileSearch(true);
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);
  useEffect(() => { if (mobileSearch) mobileSearchInputRef.current?.focus(); }, [mobileSearch]);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const formatAge = (value) => {
    if (!value) return "Recently";
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  const openNotification = async (item) => {
    if (!item.read) await onMarkNotificationRead(item.id);
    setNotificationsOpen(false);
    if (item.type === "TRIAL_EXPIRING" || item.type === "TRIAL_EXPIRED") navigate("Trials");
    else if (item.type === "DEMO_UPCOMING") navigate("Demos");
    else navigate("Follow-ups");
  };
  const selectPage = (id) => { navigate(id); setMoreOpen(false); setMobileNav(false); };
  const renderSidebarItem = (item) => {
    const Icon = navIcons[item.id] || CircleHelp;
    const active = pageTitle === item.id;
    return <button key={item.id} type="button" onClick={() => selectPage(item.id)} aria-current={active ? "page" : undefined} className={`atlas-side-link ${active ? "is-active" : ""}`}><Icon size={19} strokeWidth={active ? 2.25 : 1.8}/><span>{item.label}</span>{active && <span className="atlas-side-active-dot"/>}</button>;
  };

  return <>
    {mobileNav && <button className="atlas-sidebar-scrim lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`atlas-sidebar ${mobileNav ? "is-mobile-open" : ""} ${desktopCollapsed ? "is-desktop-collapsed" : ""}`} aria-label="Workspace navigation" onMouseEnter={() => { if (window.matchMedia("(min-width: 1024px)").matches) setDesktopCollapsed(false); }} onMouseLeave={(event) => { if (window.matchMedia("(min-width: 1024px)").matches && !event.currentTarget.contains(document.activeElement)) setDesktopCollapsed(true); }} onFocusCapture={() => { if (window.matchMedia("(min-width: 1024px)").matches) setDesktopCollapsed(false); }} onBlurCapture={(event) => { if (window.matchMedia("(min-width: 1024px)").matches && !event.currentTarget.contains(event.relatedTarget)) setDesktopCollapsed(true); }}>
      <div className="atlas-sidebar-brand">
        <div className="atlas-brand-mark"><Leaf size={22} strokeWidth={1.9}/></div>
        <div className="min-w-0"><div className="atlas-brand-name">CRM</div></div>
        
        <button className="atlas-sidebar-close lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={19}/></button>
      </div>
      <nav className="atlas-sidebar-nav" aria-label="Main navigation">{primaryItems.map(renderSidebarItem)}</nav>
      {moreItems.length > 0 && <>
        <div className="atlas-sidebar-section-label atlas-sidebar-section-more">MANAGE</div>
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)} className={`atlas-side-link atlas-more-trigger ${moreItems.some((item) => item.id === pageTitle) ? "is-active" : ""}`}><MoreHorizontal size={19}/><span>More workspace tools</span><ChevronDown size={16} className={moreOpen ? "atlas-more-chevron is-open" : "atlas-more-chevron"}/></button>
        {moreOpen && <nav className="atlas-sidebar-nav atlas-more-items" aria-label="More navigation">{moreItems.map(renderSidebarItem)}</nav>}
      </>}
      <div className="atlas-sidebar-bottom">
        <button className={`atlas-side-link atlas-settings-link ${pageTitle === "Settings" ? "is-active" : ""}`} onClick={() => selectPage("Settings")}><Settings size={19}/><span>Settings</span></button>
        <div className="atlas-sidebar-user"><Avatar name={currentUser} size="sm"/><div className="min-w-0 flex-1"><strong className="block truncate">{currentUser || "Workspace user"}</strong><small>{role.replaceAll("_", " ")}</small></div><button aria-label="Sign out" title="Sign out" className="atlas-logout-icon" onClick={() => void onLogout()}><LogOut size={17}/></button></div>
      </div>
    </aside>

    <div className="atlas-workspace-main">
      <header className="atlas-commandbar">
        <div className="atlas-commandbar-left"><button type="button" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)} className="atlas-mobile-menu lg:hidden"><Menu size={20}/></button><div className="atlas-breadcrumb"><span>Workspace</span><span className="atlas-breadcrumb-slash">/</span><strong>{pageTitle === "Overview" ? "Overview" : (topNavItems.find((item) => item.id === pageTitle)?.label || pageTitle)}</strong></div></div>
        <div className="atlas-commandbar-actions">
          <div className="atlas-global-search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSearchFocused(false); }}><Search size={17}/><input ref={searchInputRef} aria-label="Search accounts, contacts, and leads" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} onFocus={() => setSearchFocused(true)} placeholder="Search anything..."/><kbd>⌘ K</kbd>
            {searchFocused && globalSearch.trim() && <div className="atlas-search-results"><p className="atlas-popover-eyebrow">SEARCH RESULTS</p>{globalResults.length ? globalResults.map((result) => <button key={`${result.type}-${result.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onSelectSearchResult?.(result); setSearchFocused(false); setMobileSearch(false); }}><span className="atlas-search-result-icon"><Building2 size={17}/></span><span className="min-w-0 flex-1"><strong className="block truncate">{result.title}</strong><small className="block truncate">{result.subtitle} · Account</small></span><ArrowUpRight size={15}/></button>) : <p className="atlas-no-results">No matching accounts found.</p>}</div>}
          </div>
          <button type="button" aria-label="Search" onClick={() => setMobileSearch(!mobileSearch)} className="atlas-command-icon lg:hidden"><Search size={18}/></button>
          <div className="relative"><button type="button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} className="atlas-command-icon"><Bell size={19}/>{unreadCount > 0 && <span className="atlas-notification-dot">{Math.min(unreadCount, 9)}</span>}</button>
            {notificationsOpen && <div className="atlas-popover atlas-notifications-popover"><div className="atlas-popover-heading"><div><strong>Notifications</strong><small>Updates from your workspace</small></div>{unreadCount > 0 && <button onClick={onMarkAllNotifications}>Mark all read</button>}</div>{notifications.length ? notifications.slice(0, 6).map((item) => <button key={item.id} onClick={() => openNotification(item)} className={`atlas-notification-row ${item.read ? "is-read" : ""}`}><span className={`atlas-notification-status ${item.read ? "" : "is-unread"}`}/><span className="min-w-0 flex-1"><strong>{item.title}</strong><small>{item.message}</small><em>{formatAge(item.createdAt)}</em></span></button>) : <div className="atlas-notifications-empty"><Bell size={22}/><strong>You're all caught up</strong><span>Reminders will appear here.</span></div>}<button className="atlas-popover-footer" onClick={() => { setNotificationsOpen(false); navigate("Follow-ups"); }}>View follow-ups <ArrowUpRight size={15}/></button></div>}
          </div>
          <div className="relative"><button type="button" aria-label="Open account menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }} className="atlas-profile-trigger"><Avatar name={currentUser} size="sm"/><span className="atlas-profile-name">{currentUser}</span><ChevronDown size={15}/></button>
            {profileOpen && <div className="atlas-popover atlas-profile-popover"><div className="atlas-profile-summary"><strong>{currentUser}</strong><small>{role.replaceAll("_", " ")}</small></div><button onClick={() => { navigate("Settings"); setProfileOpen(false); }}><Settings size={16}/>Account settings</button><button className="is-danger" onClick={() => { setProfileOpen(false); void onLogout(); }}><LogOut size={16}/>Sign out</button></div>}
          </div>
        </div>
      </header>
      {mobileSearch && <div className="atlas-mobile-search"><SearchInput inputRef={mobileSearchInputRef} value={globalSearch} onChange={(value) => setGlobalSearch(value)} placeholder="Search accounts, contacts, leads..."/><div>{globalSearch.trim() && (globalResults.length ? globalResults.map((result) => <button key={`${result.type}-${result.id}`} onClick={() => { onSelectSearchResult?.(result); setSearchFocused(false); setMobileSearch(false); }}><strong>{result.title}</strong><small>{result.subtitle}</small></button>) : <p>No matching accounts found.</p>)}</div></div>}
    </div>
  </>;
}

function SettingsPage({ user, onUserUpdated }) {
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  useEffect(() => { setName(user?.name || ""); setPhone(user?.phone || ""); }, [user?.id, user?.name, user?.phone]);
  const field = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100";
  const saveProfile = async (event) => {
    event.preventDefault(); if (savingProfile) return; setSavingProfile(true);
    try { const result = await api.patch("/auth/profile", { name: name.trim(), phone: phone.trim() }); onUserUpdated(result.user); toast.success("Profile updated"); }
    catch (error) { toast.error("Could not update profile", { description: error.message }); }
    finally { setSavingProfile(false); }
  };
  const changePassword = async (event) => {
    event.preventDefault(); if (savingPassword) return;
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match."); return; }
    if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { toast.error("Use at least 12 characters, including uppercase, lowercase and a number."); return; }
    setSavingPassword(true);
    try { const result = await api.post("/auth/change-password", { currentPassword, newPassword }); onUserUpdated(result.user); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); toast.success("Password changed. Other sessions were signed out."); }
    catch (error) { toast.error("Could not change password", { description: error.message }); }
    finally { setSavingPassword(false); }
  };
  return <div className="mx-auto max-w-4xl">
    <div className="mb-6"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-violet-600">Account</p><h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[30px]">Settings</h1></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(28,20,54,0.025)] sm:p-6">
        <div className="mb-5"><h2 className="text-sm font-bold text-slate-900">Profile details</h2></div>
        <form onSubmit={saveProfile} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Full name</span><input required minLength={2} maxLength={100} className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Work email</span><input disabled className={`${field} bg-slate-50 text-slate-500`} value={user?.email || ""}/><span className="mt-1 block text-[10px] text-slate-400">Email changes are managed by an administrator.</span></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Phone (optional)</span><input type="tel" maxLength={24} className={field} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="Add a contact number"/></label>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">{String(user?.role || "STAFF").replaceAll("_", " ")}</span><button disabled={savingProfile} className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-60">{savingProfile ? "Saving…" : "Save profile"}</button></div>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(28,20,54,0.025)] sm:p-6">
        <div className="mb-5"><h2 className="text-sm font-bold text-slate-900">Change password</h2><p className="mt-1 text-xs leading-5 text-slate-500">Use a unique password with at least 12 characters.</p></div>
        <form onSubmit={changePassword} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Current password</span><input required type="password" autoComplete="current-password" className={field} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">New password</span><input required minLength={12} type="password" autoComplete="new-password" className={field} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 12 characters"/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm new password</span><input required minLength={12} type="password" autoComplete="new-password" className={field} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}/></label>
          <div className="border-t border-slate-100 pt-4"><button disabled={savingPassword} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">{savingPassword ? "Updating…" : "Update password"}</button></div>
        </form>
      </section>
    </div>
  </div>;
}

export default App;
