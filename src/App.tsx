import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  ArrowRight, BadgeCheck, ChartNoAxesCombined, CircleAlert, Download, Eye, Pencil, Trash2, X,
  CircleHelp, ClipboardList, History, House, LoaderCircle, LogOut, RefreshCw,
  Save, Settings, ShieldCheck,
} from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { amountOrZero, formatMoney, formatSunday, getSundayInKampala, isSunday, type SalesDraft, type SalesSummary } from './lib/sales'
import { supabase, supabaseConfigured } from './lib/supabase'
import type { Database } from './lib/database.types'

type View = 'dashboard' | 'history' | 'settings'
const viewOrder: Record<View, number> = { dashboard: 0, history: 1, settings: 2 }
const pageVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 22 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -18 }),
}
type FormValues = { ids_printed: string; mtn_amount: string; airtel_amount: string; expenses: string; cash_deposited: string }
type TeamProfile = Database['public']['Tables']['profiles']['Row']

const emptyForm: FormValues = { ids_printed: '', mtn_amount: '', airtel_amount: '', expenses: '', cash_deposited: '' }

function displayName(user: User | null) {
  if (!user) return 'Cashier'
  const name = user.user_metadata?.full_name || user.user_metadata?.name
  return typeof name === 'string' && name.trim() ? name.trim() : user.email || 'Cashier'
}

function ErrorNotice({ children }: { children: string }) {
  return <div className="notice notice-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{children}</div>
}

function SetupScreen() {
  return (
    <main className="setup-shell">
      <div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></div>
      <Card className="setup-card">
        <CardHeader><div className="setup-icon"><ShieldCheck size={20} /></div><CardTitle>Connect your Supabase project</CardTitle><p className="muted">The app is ready. Add your project credentials to enable team sign-in and saved summaries.</p></CardHeader>
        <CardContent>
          <ol className="setup-steps">
            <li><span>1</span><div><strong>Copy the environment template</strong><p>Duplicate <code>.env.example</code> as <code>.env.local</code>.</p></div></li>
            <li><span>2</span><div><strong>Add your project URL and anon key</strong><p>Find both in Supabase under Project Settings → API.</p></div></li>
            <li><span>3</span><div><strong>Set up approvals and team access</strong><p>Follow <code>SUPABASE_SETUP.md</code> to apply the SQL and create the first admin.</p></div></li>
          </ol>
          <p className="setup-foot"><CircleHelp size={15} /> The anon key is designed for browser use. Keep the service role key private.</p>
        </CardContent>
      </Card>
    </main>
  )
}

function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setPending(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (signInError) toast.error(signInError.message.includes('Invalid login') ? 'Email or password is incorrect.' : signInError.message)
    else if (data.session) onSignedIn(data.session)
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setPending(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
    })
    setPending(false)
    if (signUpError) toast.error(signUpError.message)
    else if (data.session) onSignedIn(data.session)
    else toast.success('Check your email to confirm your account. Then an admin can approve your request.', { duration: 6000 })
  }

  async function sendSignInLink() {
    if (!supabase) return
    if (!email.trim()) { toast.error('Enter your email first.'); return }
    setPending(true)
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    setPending(false)
    if (linkError) toast.error(linkError.message)
    else toast.success('If that email belongs to an account, a sign-in link is on its way.')
  }

  return (
    <main className="setup-shell">
      <div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></div>
      <Card className="signin-card">
        <CardHeader><div className="eyebrow">Team access</div><CardTitle>{mode === 'signup' ? 'Create a cashier account' : 'Sign in to continue'}</CardTitle><p className="muted">{mode === 'signup' ? 'Register with your name and email. Sales access starts after admin approval.' : 'Sign in to record and review Sunday sales.'}</p></CardHeader>
        <CardContent>
          <form className="signin-form" onSubmit={mode === 'signup' ? handleSignUp : handleSubmit}>
            {mode === 'signup' && <div className="field"><Label htmlFor="full-name">Full name</Label><Input id="full-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></div>}
            <div className="field"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div className="field"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}{mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
            {mode === 'signin' && <Button type="button" variant="outline" disabled={pending} onClick={sendSignInLink}>{pending ? <LoaderCircle className="spin" size={16} /> : null}Email a sign-in link</Button>}
          </form>
          <p className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New cashier?'} <button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
          <p className="signin-foot">New accounts must confirm their email and wait for admin approval before accessing sales.</p>
        </CardContent>
      </Card>
    </main>
  )
}

function AwaitingApproval({
  profile,
  onCheck,
  onSignOut,
  checking,
}: {
  profile: TeamProfile
  onCheck: () => void
  onSignOut: () => void
  checking: boolean
}) {
  const rejected = profile.approval_status === 'rejected'
  const emailUnconfirmed = !profile.email_confirmed_at
  return (
    <main className="setup-shell">
      <div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></div>
      <Card className="approval-state-card">
        <div className={rejected ? 'approval-state-icon rejected' : 'approval-state-icon'}>{rejected ? <CircleAlert size={21} /> : <ShieldCheck size={21} />}</div>
        <div className="eyebrow">Cashier account</div>
        <h1>{rejected ? 'Request not approved' : emailUnconfirmed ? 'Confirm your email' : 'Waiting for admin approval'}</h1>
        <p>{rejected
          ? 'Your access request was not approved. Please contact the Sunday Close administrator if you think this is a mistake.'
          : emailUnconfirmed
            ? 'Check your inbox for the confirmation link. After you confirm your email, an admin can review your access request.'
            : 'Your account request has been sent to the admin. You’ll be able to record and review sales once it is approved.'}</p>
        <div className="approval-account"><span className="recorded-avatar">{(profile.display_name || profile.email).slice(0, 1).toUpperCase()}</span><span><strong>{profile.display_name || profile.email}</strong><small>{profile.email}</small></span></div>
        {!rejected && <Button variant="outline" onClick={onCheck} disabled={checking}>{checking ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}Check approval status</Button>}
        <Button variant="ghost" onClick={onSignOut}><LogOut size={15} />Sign out</Button>
      </Card>
    </main>
  )
}

function SummaryViewDialog({
  summary,
  onClose,
  onEdit,
  onDownload,
}: {
  summary: SalesSummary
  onClose: () => void
  onEdit: () => void
  onDownload: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const worked = summary.mtn_amount + summary.airtel_amount + summary.cash_deposited
  const cashAtHand = Math.max(0, summary.cash_deposited - summary.expenses)
  const cashier = summary.recorder?.display_name || summary.recorder?.email || 'Team cashier'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="summary-dialog"
      aria-labelledby="summary-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <header className="summary-dialog-header">
        <div><div className="eyebrow">Sunday sales record</div><h2 id="summary-dialog-title">{formatSunday(summary.sunday_date)}</h2><p>Recorded by <strong>{cashier}</strong></p></div>
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close summary"><X size={18} /></button>
      </header>
      <div className="summary-dialog-body">
        <div className="dialog-metrics">
          <div className="dialog-metric worked"><span>Total amount worked</span><strong>{formatMoney(worked)}</strong></div>
          <div className="dialog-metric"><span>Cash at hand</span><strong>{formatMoney(cashAtHand)}</strong></div>
        </div>
        <div className="dialog-details-heading">Summary details</div>
        <dl className="dialog-details">
          <div><dt>IDs printed</dt><dd>{summary.ids_printed.toLocaleString('en-UG')}</dd></div>
          <div><dt>MTN Mobile Money</dt><dd>{formatMoney(summary.mtn_amount)}</dd></div>
          <div><dt>Airtel Money</dt><dd>{formatMoney(summary.airtel_amount)}</dd></div>
          <div><dt>Cash deposited</dt><dd>{formatMoney(summary.cash_deposited)}</dd></div>
          <div><dt>Total expenses</dt><dd>{formatMoney(summary.expenses)}</dd></div>
        </dl>
      </div>
      <footer className="summary-dialog-actions">
        <Button variant="outline" onClick={onDownload}><Download size={15} />Download PDF</Button>
        <Button onClick={onEdit}><Pencil size={15} />Edit summary</Button>
      </footer>
    </dialog>
  )
}

function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <div className="input-wrap"><span aria-hidden="true" className="input-prefix">UGX</span><Input id={id} type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={value} onChange={(event) => onChange(event.target.value)} /></div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<TeamProfile | null>(null)
  const [profileLoadedFor, setProfileLoadedFor] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [view, setView] = useState<View>('dashboard')
  const [direction, setDirection] = useState(1)
  const [selectedDate, setSelectedDate] = useState(getSundayInKampala())
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [summaries, setSummaries] = useState<SalesSummary[]>([])
  const [viewingSummary, setViewingSummary] = useState<SalesSummary | null>(null)
  const [requests, setRequests] = useState<TeamProfile[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviewingId, setReviewingId] = useState('')

  async function refreshRequests() {
    if (!supabase || profile?.role !== 'admin') return
    setRequestsLoading(true)
    const { data, error: requestError } = await supabase.from('profiles')
      .select('*')
      .eq('approval_status', 'pending')
      .not('email_confirmed_at', 'is', null)
      .order('requested_at', { ascending: true })
    if (requestError) toast.error(`Could not load signup requests. ${requestError.message}`)
    else setRequests(data || [])
    setRequestsLoading(false)
  }

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setAuthReady(true)
      }
    }).catch(() => { if (active) setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!supabase || !userId) {
      setProfile(null)
      setProfileLoadedFor('')
      return
    }
    let active = true
    setProfileLoadedFor('')
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data, error: profileError }) => {
      if (!active) return
      setProfile(data)
      setNameDraft(data?.display_name || '')
      setProfileLoadedFor(userId)
      if (profileError) toast.error(`Could not load your account status. ${profileError.message}`)
    })
    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    if (!supabase || !session || profile?.approval_status !== 'approved') {
      setSummaries([])
      setHistoryLoading(false)
      return
    }
    let active = true
    setHistoryLoading(true)
    supabase.from('sales_summaries')
      .select('*, recorder:profiles!sales_summaries_recorded_by_fkey(display_name,email)')
      .order('sunday_date', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) toast.error(`Could not load saved summaries. ${loadError.message}`)
        else setSummaries((data || []) as SalesSummary[])
        setHistoryLoading(false)
      })
    return () => { active = false }
  }, [session?.user.id, profile?.approval_status])

  useEffect(() => {
    if (!supabase || !session || profile?.role !== 'admin') {
      setRequests([])
      return
    }
    void refreshRequests()
  }, [session?.user.id, profile?.role])

  const selectedSummary = summaries.find((summary) => summary.sunday_date === selectedDate)
  const editingSummary = editingDate === selectedDate ? selectedSummary : undefined
  const dateAlreadySaved = Boolean(selectedSummary && !editingSummary)

  const ids = amountOrZero(form.ids_printed)
  const mtn = amountOrZero(form.mtn_amount)
  const airtel = amountOrZero(form.airtel_amount)
  const expenses = amountOrZero(form.expenses)
  const deposited = amountOrZero(form.cash_deposited)
  const worked = mtn + airtel + deposited
  const rawCashAtHand = deposited - expenses
  const cashAtHand = Math.max(0, rawCashAtHand)
  const cashShortfall = Math.max(0, expenses - deposited)
  const validSunday = isSunday(selectedDate)

  function setValue(key: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function navigate(nextView: View) {
    if (nextView === view) return
    setDirection(viewOrder[nextView] > viewOrder[view] ? 1 : -1)
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editSummary(summary: SalesSummary) {
    setSelectedDate(summary.sunday_date)
    setEditingDate(summary.sunday_date)
    setForm({
      ids_printed: String(summary.ids_printed),
      mtn_amount: String(summary.mtn_amount),
      airtel_amount: String(summary.airtel_amount),
      expenses: String(summary.expenses),
      cash_deposited: String(summary.cash_deposited),
    })
    navigate('dashboard')
  }

  async function saveSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session) return
    if (!validSunday) { toast.error('Choose a Sunday to save this summary.'); return }
    if (dateAlreadySaved) { toast.error('A summary already exists for this Sunday. Edit it from History.'); return }
    setSaving(true)
    const draft: SalesDraft = {
      sunday_date: selectedDate,
      ids_printed: Math.floor(ids),
      mtn_amount: mtn,
      airtel_amount: airtel,
      expenses,
      cash_deposited: deposited,
    }
    const saveRequest = editingSummary
      ? supabase.from('sales_summaries').update({
          ids_printed: draft.ids_printed,
          mtn_amount: draft.mtn_amount,
          airtel_amount: draft.airtel_amount,
          expenses: draft.expenses,
          cash_deposited: draft.cash_deposited,
        }).eq('sunday_date', selectedDate)
      : supabase.from('sales_summaries').insert({ ...draft, recorded_by: session.user.id })
    const { data, error: saveError } = await saveRequest
      .select('*, recorder:profiles!sales_summaries_recorded_by_fkey(display_name,email)')
      .single()
    setSaving(false)
    if (saveError) {
      toast.error(saveError.code === '23505'
        ? 'A summary already exists for this Sunday. Edit it from History.'
        : saveError.message.includes('sales_summaries')
          ? 'Could not save the summary. Check that the Supabase setup SQL has been applied.'
          : saveError.message)
      return
    }
    setSummaries((current) => [data as SalesSummary, ...current.filter((item) => item.sunday_date !== selectedDate)].sort((a, b) => b.sunday_date.localeCompare(a.sunday_date)))
    setForm(emptyForm)
    setEditingDate(null)
    toast.success(editingSummary ? `Summary for ${formatSunday(selectedDate)} updated.` : `Summary for ${formatSunday(selectedDate)} saved.`)
  }

  async function deleteSummary(summary: SalesSummary) {
    if (!supabase) return
    if (!window.confirm(`Delete the sales summary for ${formatSunday(summary.sunday_date)}? This cannot be undone.`)) return
    const { error: deleteError } = await supabase.from('sales_summaries').delete().eq('sunday_date', summary.sunday_date)
    if (deleteError) { toast.error(`Could not delete the summary. ${deleteError.message}`); return }
    setSummaries((current) => current.filter((item) => item.sunday_date !== summary.sunday_date))
    if (editingDate === summary.sunday_date) {
      setEditingDate(null)
      setForm(emptyForm)
    }
    toast.success(`Summary for ${formatSunday(summary.sunday_date)} deleted.`)
  }

  function downloadCurrentPdf() {
    if (!validSunday) { toast.error('Choose a Sunday before downloading the PDF.'); return }
    void exportPdf({
      sunday_date: selectedDate,
      ids_printed: Math.floor(ids),
      mtn_amount: mtn,
      airtel_amount: airtel,
      expenses,
      cash_deposited: deposited,
    }, selectedSummary?.recorder?.display_name || selectedSummary?.recorder?.email || currentUserName)
  }

  function downloadSavedPdf(summary: SalesSummary) {
    void exportPdf({
      sunday_date: summary.sunday_date,
      ids_printed: summary.ids_printed,
      mtn_amount: summary.mtn_amount,
      airtel_amount: summary.airtel_amount,
      expenses: summary.expenses,
      cash_deposited: summary.cash_deposited,
    }, summary.recorder?.display_name || summary.recorder?.email || 'Team cashier', true)
  }

  async function exportPdf(draft: SalesDraft, cashier: string, isSaved = false) {
    try {
      const { downloadSalesSummaryPdf } = await import('./lib/sales-pdf')
      downloadSalesSummaryPdf(draft, cashier, isSaved)
      toast.success('Sunday sales PDF downloaded.')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      toast.error(`PDF download failed: ${detail}`, { duration: 7000 })
    }
  }

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) toast.error(signOutError.message)
  }

  async function checkApprovalStatus() {
    if (!supabase || !session) return
    setProfileLoadedFor('')
    const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    if (profileError) toast.error(`Could not check approval status. ${profileError.message}`)
    else {
      setProfile(data)
      setNameDraft(data?.display_name || '')
      setProfileLoadedFor(session.user.id)
    }
  }

  async function reviewRequest(userId: string, decision: 'approved' | 'rejected') {
    if (!supabase) return
    setReviewingId(userId)
    const { error: reviewError } = await supabase.rpc('review_cashier_request', { target_user_id: userId, decision })
    setReviewingId('')
    if (reviewError) {
      toast.error(`Could not update this request. ${reviewError.message}`)
      return
    }
    setRequests((current) => current.filter((request) => request.id !== userId))
    toast.success(decision === 'approved' ? 'Cashier approved. They can now access sales.' : 'Signup request declined.')
  }

  async function saveProfileName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session || !profile) return
    const trimmedName = nameDraft.trim()
    if (!trimmedName) { toast.error('Enter a name before saving.'); return }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: trimmedName } })
    if (updateError) {
      setSaving(false)
      toast.error(`Could not update your name. ${updateError.message}`)
      return
    }
    const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setSaving(false)
    if (profileError) toast.error(`Your name was updated, but the profile could not refresh. ${profileError.message}`)
    else {
      setProfile(data)
      setNameDraft(data.display_name || '')
      toast.success('Profile name updated.')
    }
  }

  if (!supabaseConfigured) return <SetupScreen />
  if (!authReady) return <main className="loading-screen"><LoaderCircle className="spin" size={20} /><span>Connecting securely…</span></main>
  if (!session) return <SignIn onSignedIn={setSession} />
  if (profileLoadedFor !== session.user.id) return <main className="loading-screen"><LoaderCircle className="spin" size={20} /><span>Checking account approval…</span></main>
  if (!profile) return <main className="setup-shell"><div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></div><Card className="approval-state-card"><ErrorNotice>Your account profile is not ready yet. Contact the app administrator.</ErrorNotice><Button variant="ghost" onClick={signOut}><LogOut size={15} />Sign out</Button></Card></main>
  if (profile.approval_status !== 'approved') return <AwaitingApproval profile={profile} onCheck={checkApprovalStatus} onSignOut={signOut} checking={profileLoadedFor !== session.user.id} />

  const currentUserName = profile.display_name || displayName(session.user)
  const pages: { id: View; label: string; icon: typeof House }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: House },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]
  const pageInfo = {
    dashboard: { eyebrow: 'Weekly close', title: 'Sunday sales', description: 'Record this Sunday’s figures and review the closing balance.' },
    history: { eyebrow: 'Sales records', title: 'History', description: 'Browse saved Sunday summaries and who recorded them.' },
    settings: { eyebrow: 'Your workspace', title: 'Settings', description: 'Manage your account and team access.' },
  }[view]
  return (
    <MotionConfig reducedMotion="user">
      <main className="app-shell">
        <header className="topbar">
          <a className="brand" href="#main" aria-label="Sunday Close home"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></a>
          <div className="account"><span className="user-avatar" aria-hidden="true">{currentUserName.slice(0, 1).toUpperCase()}</span><span className="account-name">{currentUserName}</span></div>
        </header>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            className="page-transition"
            key={view}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            aria-labelledby="page-title"
          >
            <section className="page-heading" id="main">
              <div><div className="eyebrow">{pageInfo.eyebrow}</div><h1 id="page-title">{pageInfo.title}</h1><p>{pageInfo.description}</p></div>
              {view === 'dashboard' && <div className="heading-date"><span className="date-dot" />{formatSunday(selectedDate)}</div>}
            </section>

            {view === 'dashboard' ? (
              <div className="main-grid">
                <Card className="entry-card">
                  <CardHeader className="entry-header"><div><CardTitle>{editingSummary ? 'Edit Sunday’s figures' : 'Enter Sunday’s figures'}</CardTitle><p>Enter amounts in Ugandan shillings.</p></div>{editingSummary && <Badge>Editing</Badge>}</CardHeader>
                  <CardContent>
                    <form onSubmit={saveSummary}>
                      <div className="field date-field"><Label htmlFor="sunday-date">Sunday date</Label><Input id="sunday-date" type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setEditingDate(null); setForm(emptyForm) }} aria-describedby={!validSunday ? 'date-error' : dateAlreadySaved ? 'date-saved-hint' : undefined} /></div>
                      {!validSunday && <p className="field-error" id="date-error">Please select a Sunday.</p>}
                      {dateAlreadySaved && <p className="field-hint saved-date-hint" id="date-saved-hint">A summary is already saved for this Sunday. Edit or delete it from History.</p>}
                      <div className="fields-grid">
                        <div className="field"><Label htmlFor="ids-printed">IDs printed</Label><Input id="ids-printed" type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={form.ids_printed} onChange={(event) => setValue('ids_printed', event.target.value)} /><span className="field-hint">Number of IDs issued</span></div>
                        <MoneyField id="mtn-amount" label="MTN Mobile Money" value={form.mtn_amount} onChange={(value) => setValue('mtn_amount', value)} />
                        <MoneyField id="airtel-amount" label="Airtel Money" value={form.airtel_amount} onChange={(value) => setValue('airtel_amount', value)} />
                        <MoneyField id="expenses" label="Total expenses" value={form.expenses} onChange={(value) => setValue('expenses', value)} />
                        <MoneyField id="cash-deposited" label="Cash deposited" value={form.cash_deposited} onChange={(value) => setValue('cash_deposited', value)} />
                      </div>
                      <div className="form-note"><CircleHelp size={15} /><span>IDs are recorded as a count. Expenses are deducted from physical cash to calculate cash at hand.</span></div>
                      <Button type="submit" className="save-button" disabled={saving || !validSunday || dateAlreadySaved}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{editingSummary ? 'Save changes' : 'Save Sunday summary'}</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="summary-card" aria-live="polite">
                    <CardHeader className="summary-header"><CardTitle>Closing summary</CardTitle><div className="summary-header-actions"><Badge className="badge-live">LIVE</Badge><Button variant="outline" size="sm" onClick={downloadCurrentPdf} disabled={!validSunday || dateAlreadySaved}><Download size={14} />Download PDF</Button></div></CardHeader>
                  <CardContent>
                    <div className="metric-label">Total amount worked</div><div className="worked-total">{formatMoney(worked)}</div><div className="metric-support">{formatMoney(mtn)} mobile money <span>·</span> {formatMoney(deposited)} cash</div>
                    <div className="summary-divider" />
                    <div className="balance-row"><div><div className="metric-label">Cash at hand</div><div className={rawCashAtHand < 0 ? 'balance-status status-warning' : 'balance-status'}><span className="status-dot" />{rawCashAtHand < 0 ? `Expenses exceed cash by ${formatMoney(cashShortfall)}` : 'After expenses'}</div></div><div className="balance-value">{formatMoney(cashAtHand)}</div></div>
                    <div className="breakdown"><h3>Money received</h3><div className="breakdown-row"><span>MTN Mobile Money</span><strong>{formatMoney(mtn)}</strong></div><div className="breakdown-row"><span>Airtel Money</span><strong>{formatMoney(airtel)}</strong></div><div className="breakdown-row"><span>Cash deposited</span><strong>{formatMoney(deposited)}</strong></div><div className="breakdown-row deduction"><span>Expenses</span><strong>− {formatMoney(expenses)}</strong></div></div>
                    <div className="recorded-by"><span className="recorded-avatar">{(selectedSummary?.recorder?.display_name || selectedSummary?.recorder?.email || currentUserName).slice(0, 1).toUpperCase()}</span><span>{selectedSummary ? <>Recorded by <strong>{selectedSummary.recorder?.display_name || selectedSummary.recorder?.email || 'Team cashier'}</strong></> : <>Will be recorded by <strong>{currentUserName}</strong></>}</span></div>
                  </CardContent>
                </Card>
              </div>
            ) : view === 'history' ? (
              <Card className="history-card">
                <CardHeader className="history-header"><div><CardTitle>Past Sundays</CardTitle><p>Saved sales summaries, newest first.</p></div><span className="history-total">{summaries.length} {summaries.length === 1 ? 'record' : 'records'}</span></CardHeader>
                {historyLoading ? <div className="history-loading"><LoaderCircle className="spin" size={18} />Loading summaries…</div> : summaries.length === 0 ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={21} /></div><h3>No summaries saved yet</h3><p>Save a Sunday’s sales figures and they’ll appear here.</p><Button variant="outline" onClick={() => navigate('dashboard')}>Record sales</Button></div> : (
                  <div className="history-list">
                    <div className="history-grid history-labels"><span>Sunday</span><span>IDs</span><span>Total worked</span><span>Cash at hand</span><span>Recorded by</span><span>Actions</span></div>
                    {summaries.map((summary) => {
                      const total = summary.mtn_amount + summary.airtel_amount + summary.cash_deposited
                      const balance = Math.max(0, summary.cash_deposited - summary.expenses)
                      const cashier = summary.recorder?.display_name || summary.recorder?.email || 'Team cashier'
                      return <div className="history-grid history-item" key={summary.sunday_date}>
                        <span className="history-date">{formatSunday(summary.sunday_date)}</span><span>{summary.ids_printed.toLocaleString('en-UG')}</span><strong>{formatMoney(total)}</strong><strong>{formatMoney(balance)}</strong><span className="history-cashier"><span className="cashier-avatar">{cashier.slice(0, 1).toUpperCase()}</span>{cashier}</span><span className="history-actions"><Button variant="ghost" size="sm" onClick={() => setViewingSummary(summary)} aria-label={`View ${formatSunday(summary.sunday_date)} summary`} title="View"><Eye size={14} /></Button><Button variant="ghost" size="sm" onClick={() => editSummary(summary)} aria-label={`Edit ${formatSunday(summary.sunday_date)} summary`} title="Edit"><Pencil size={14} /></Button><Button variant="outline" size="sm" onClick={() => downloadSavedPdf(summary)} aria-label={`Download ${formatSunday(summary.sunday_date)} PDF`} title="Download PDF"><Download size={14} /></Button><Button variant="ghost" size="sm" className="delete-action" onClick={() => deleteSummary(summary)} aria-label={`Delete ${formatSunday(summary.sunday_date)} summary`} title="Delete"><Trash2 size={14} /></Button></span>
                      </div>
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <div className="settings-grid">
                <Card className="settings-card">
                  <CardHeader className="settings-header"><div className="settings-profile-avatar">{currentUserName.slice(0, 1).toUpperCase()}</div><div><CardTitle>Account</CardTitle><p>Signed in to Sunday Close</p></div></CardHeader>
                  <CardContent>
                    <form className="settings-name-form" onSubmit={saveProfileName}><div className="field"><Label htmlFor="settings-name">Display name</Label><Input id="settings-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={80} required /></div><Button size="sm" type="submit" disabled={saving || nameDraft.trim() === (profile.display_name || '')}>{saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}Save name</Button></form>
                    <div className="settings-detail"><span>Email</span><strong>{profile.email}</strong></div>
                    <div className="settings-detail"><span>Account type</span><strong>{profile.role === 'admin' ? 'Administrator' : 'Cashier'}</strong></div>
                    <div className="settings-detail"><span>Access status</span><Badge className="settings-approved">Approved</Badge></div>
                    <div className="settings-security"><ShieldCheck size={16} /><span>Your account is approved to view and record shared Sunday sales summaries.</span></div>
                    <Button variant="outline" className="settings-signout" onClick={signOut}><LogOut size={15} />Sign out</Button>
                  </CardContent>
                </Card>
                {profile.role === 'admin' && <Card className="requests-card">
                  <CardHeader className="history-header"><div><CardTitle>Cashier approvals</CardTitle><p>Review new accounts before they can access sales.</p></div><Button variant="outline" size="sm" onClick={refreshRequests} disabled={requestsLoading}>{requestsLoading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}Refresh</Button></CardHeader>
                  {requestsLoading ? <div className="history-loading"><LoaderCircle className="spin" size={18} />Loading requests…</div> : requests.length === 0 ? <div className="empty-state"><div className="empty-icon"><BadgeCheck size={21} /></div><h3>No pending requests</h3><p>New requests appear here after the cashier confirms their email.</p></div> : (
                    <div className="request-list">
                      {requests.map((request) => (
                        <div className="request-row" key={request.id}>
                          <span className="request-avatar">{(request.display_name || request.email).slice(0, 1).toUpperCase()}</span>
                          <div className="request-info"><strong>{request.display_name || request.email}</strong><span>{request.email}</span><small>Requested {request.requested_at ? new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeZone: 'Africa/Kampala' }).format(new Date(request.requested_at)) : 'recently'}</small></div>
                          <div className="request-actions"><Button size="sm" onClick={() => reviewRequest(request.id, 'approved')} disabled={reviewingId !== ''}>{reviewingId === request.id ? <LoaderCircle className="spin" size={14} /> : <BadgeCheck size={14} />}Approve</Button><Button size="sm" variant="outline" onClick={() => reviewRequest(request.id, 'rejected')} disabled={reviewingId !== ''}>Decline</Button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>}
              </div>
            )}
          </motion.section>
        </AnimatePresence>

        <nav className="floating-nav" aria-label="Main navigation">
          {pages.map((page) => {
            const Icon = page.icon
            const pendingApprovalCount = page.id === 'settings' && profile.role === 'admin' ? requests.length : 0
            return <button key={page.id} className={view === page.id ? 'floating-nav-item active' : 'floating-nav-item'} onClick={() => navigate(page.id)} aria-label={pendingApprovalCount > 0 ? `Settings, ${pendingApprovalCount} pending approvals` : page.label} title={page.label} aria-current={view === page.id ? 'page' : undefined}>
              {view === page.id && <motion.span className="floating-nav-bubble" layoutId="floating-nav-bubble" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              {pendingApprovalCount > 0 && <span className="nav-notice-dot" aria-hidden="true" />}
            </button>
          })}
        </nav>
        {viewingSummary && <SummaryViewDialog summary={viewingSummary} onClose={() => setViewingSummary(null)} onEdit={() => { const summary = viewingSummary; setViewingSummary(null); editSummary(summary) }} onDownload={() => downloadSavedPdf(viewingSummary)} />}
      </main>
    </MotionConfig>
  )
}

export default App
