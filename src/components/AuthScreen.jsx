import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import authSketch from "../assets/kerala-auth-botanical.svg";

export default function AuthScreen({ user, onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get("invite") || "");
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsChange = Boolean(user?.mustChangePassword);
  const needsInvite = Boolean(inviteToken);
  const needsReset = Boolean(resetToken);

  useEffect(() => {
    if (!inviteToken && !resetToken) return;
    const query = new URLSearchParams(window.location.search);
    query.delete("invite"); query.delete("reset");
    const remaining = query.toString();
    window.history.replaceState({}, "", window.location.pathname + (remaining ? `?${remaining}` : "") + window.location.hash);
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if ((needsChange || needsInvite || needsReset) && newPassword !== confirmPassword) {
      toast.error("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (needsInvite) {
        const result = await api.post("/auth/accept-invite", { token: inviteToken, password: newPassword });
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        setInviteToken(""); setNewPassword(""); setConfirmPassword("");
        onAuthenticated(result.user);
        toast.success(`Welcome to Atlas CRM, ${result.user.name.split(" ")[0]}.`);
        return;
      }
      if (needsReset) {
        const result = await api.post("/auth/reset-password", { token: resetToken, password: newPassword });
        setResetToken(""); setNewPassword(""); setConfirmPassword(""); setEmail(result.email || "");
        toast.success("Password reset successfully", { description: "Sign in using your new password." });
        return;
      }
      if (forgotMode) {
        const result = await api.post("/auth/forgot-password", { email });
        setResetRequested(true);
        toast.success(result.message || "If an active account matches, a reset link has been sent.");
        return;
      }
      const result = needsChange
        ? await api.post("/auth/change-password", { currentPassword, newPassword })
        : await api.post("/auth/login", { email, password });
      const nextUser = result.user;
      onAuthenticated(nextUser);
      if (needsChange) toast.success("Password changed successfully.");
      else toast.success(`Welcome back, ${nextUser.name.split(" ")[0]}.`);
    } catch (error) {
      toast.error(needsInvite ? "Could not finish account setup" : needsReset ? "Could not reset password" : forgotMode ? "Could not request a reset link" : needsChange ? "Could not change password" : "Sign in failed", { description: error.message });
    } finally { setBusy(false); }
  }

  return <div className="auth-screen relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f2e9] px-3 py-5 sm:px-6 sm:py-8">
    <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#dce7d2]/45 blur-3xl"/>
    <div className="pointer-events-none absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-[#eadfd0]/60 blur-3xl"/>
    <img src={authSketch} alt="" aria-hidden="true" className="pointer-events-none absolute -left-[8vw] top-[3vh] z-0 hidden h-[94vh] w-[31vw] max-w-[430px] object-contain opacity-75 lg:block"/>
    <img src={authSketch} alt="" aria-hidden="true" className="pointer-events-none absolute -right-[8vw] top-[3vh] z-0 hidden h-[94vh] w-[31vw] max-w-[430px] -scale-x-100 object-contain opacity-65 lg:block"/>
    <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-[#dfe1d3] bg-[#fbfaf5] shadow-[0_30px_100px_rgba(40,58,39,.14)] lg:min-h-[650px] lg:grid-cols-[.98fr_1.02fr]">
      <aside className="relative hidden min-h-[650px] overflow-hidden bg-gradient-to-br from-[#e4ebdc] via-[#edf0e5] to-[#f0e8d8] lg:block" aria-hidden="true">
        <img src={authSketch} alt="" className="absolute inset-0 h-full w-full object-cover"/>
      </aside>
      <section className="relative isolate flex min-h-[min(760px,calc(100dvh-40px))] flex-col justify-center p-5 sm:p-10 lg:px-12 xl:px-14">
        <img src={authSketch} alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 z-0 h-72 w-56 -scale-x-100 object-contain opacity-[.19] sm:h-80 sm:w-64"/>
        <div className="relative z-10 w-full">
        <div className="relative mb-5 h-32 overflow-hidden rounded-2xl border border-[#dfe5d9] bg-gradient-to-br from-[#e7ecdf] to-[#f3edde] lg:hidden"><img src={authSketch} alt="" className="h-full w-full object-cover object-[center_38%]"/></div>
        <div className="mb-9 flex items-center gap-3 lg:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#345842] text-white shadow-sm shadow-[#d6e0ce]"><Leaf size={20}/></div><div><p className="font-display text-lg font-extrabold text-slate-900">CRM</p></div></div>
        <div className="mb-7"><div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8eee0] text-[#456c4c]"><LockKeyhole size={19}/></div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#71816b]">Workspace access</p><h2 className="font-display text-3xl font-extrabold tracking-tight text-[#294638]">{needsInvite ? "Set up your account" : needsReset ? "Choose a new password" : forgotMode ? "Reset your password" : needsChange ? "Create a new password" : "Welcome back"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{needsInvite ? "Choose a secure password to activate your Atlas CRM access." : needsReset ? "Create a new password for your Atlas CRM account." : forgotMode ? "Enter your work email and we’ll send a secure reset link if it matches an active account." : needsChange ? "Choose a new password to secure your account." : "Sign in to continue to your workspace."}</p></div>
        <form onSubmit={submit} className="space-y-4">
          {!needsChange && !needsInvite && !needsReset ? <>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Work email</span><span className="relative block"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input required autoComplete="username" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setResetRequested(false); }} placeholder="name@company.com" className="ui-field h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#93aa8b] focus:ring-4 focus:ring-[#e6eddf]"/></span></label>
            {!forgotMode && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Password</span><span className="relative block"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="ui-field h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm outline-none transition focus:border-[#93aa8b] focus:ring-4 focus:ring-[#e6eddf]"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700">{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>}
          </> : <>
            {needsChange && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Current temporary password</span><input required autoComplete="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="ui-field h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#93aa8b] focus:ring-4 focus:ring-[#e6eddf]"/></label>}
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">New password</span><input required minLength={12} autoComplete="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 12 characters" className="ui-field h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#93aa8b] focus:ring-4 focus:ring-[#e6eddf]"/></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm new password</span><input required minLength={12} autoComplete="new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="ui-field h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#93aa8b] focus:ring-4 focus:ring-[#e6eddf]"/></label>
          </>}
          <button disabled={busy} type="submit" className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#345842] px-4 text-sm font-bold text-white shadow-lg shadow-[#d7e1cf]/80 transition hover:-translate-y-0.5 hover:bg-[#294638] disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : needsInvite ? "Set password and continue" : needsReset ? "Save new password" : forgotMode ? "Email reset link" : needsChange ? "Update password" : "Sign in"}<ArrowRight size={16}/></button>
        </form>
        {forgotMode && resetRequested && <p className="mt-4 rounded-xl border border-[#dce5d5] bg-[#f4f6ed] px-3.5 py-3 text-xs leading-5 text-[#52664f]">If an active account matches this email, a reset link has been sent. Check your inbox and spam folder.</p>}
        {!needsInvite && !needsReset && !needsChange && <div className="mt-4 text-center">{forgotMode ? <button type="button" onClick={() => { setForgotMode(false); setResetRequested(false); }} className="text-xs font-bold text-[#456c4c] hover:underline">Back to sign in</button> : <button type="button" onClick={() => { setForgotMode(true); setResetRequested(false); }} className="text-xs font-bold text-[#456c4c] hover:underline">Forgot password?</button>}</div>}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck size={13}/> Secure sign-in</p>
        </div>
      </section>
    </div>
  </div>;
}
