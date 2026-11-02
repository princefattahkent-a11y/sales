import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  ArrowDownLeft, ArrowRight, BadgeCheck, ChartNoAxesCombined, CircleAlert,
  CircleHelp, ClipboardList, LoaderCircle, LogOut, Save, ShieldCheck,
} from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { amountOrZero, formatMoney, formatSunday, getSundayInKampala, isSunday, type SalesDraft, type SalesSummary } from './lib/sales'
import { supabase, supabaseConfigured } from './lib/supabase'

type View = 'record' | 'history'
type FormValues = { ids_printed: string; mtn_amount: string; airtel_amount: string; expenses: string; cash_deposited: string }

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
            <li><span>3</span><div><strong>Set up the database and invited staff</strong><p>Follow <code>SUPABASE_SETUP.md</code> to apply the SQL and invite cashiers.</p></div></li>
          </ol>
          <p className="setup-foot"><CircleHelp size={15} /> The anon key is designed for browser use. Keep the service role key private.</p>
        </CardContent>
      </Card>
    </main>
  )
}

function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setPending(true)
    setError('')
    setMessage('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (signInError) setError(signInError.message.includes('Invalid login') ? 'Email or password is incorrect.' : signInError.message)
    else if (data.session) onSignedIn(data.session)
  }

  async function sendSignInLink() {
    if (!supabase) return
    if (!email.trim()) { setError('Enter your invited team email first.'); return }
    setPending(true)
    setError('')
    setMessage('')
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    setPending(false)
    if (linkError) setError(linkError.message)
    else setMessage('If that email belongs to an invited cashier, a sign-in link is on its way.')
  }

  return (
    <main className="setup-shell">
      <div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></div>
      <Card className="signin-card">
        <CardHeader><div className="eyebrow">Team access</div><CardTitle>Sign in to continue</CardTitle><p className="muted">Use the email and password from your team invitation.</p></CardHeader>
        <CardContent>
          <form className="signin-form" onSubmit={handleSubmit}>
            <div className="field"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div className="field"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            {error && <ErrorNotice>{error}</ErrorNotice>}
            {message && <div className="notice notice-success" role="status">{message}</div>}
            <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}Sign in</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={sendSignInLink}>{pending ? <LoaderCircle className="spin" size={16} /> : null}Email a sign-in link</Button>
          </form>
          <p className="signin-foot">Access is limited to invited team members. New cashiers can use an email sign-in link.</p>
        </CardContent>
      </Card>
    </main>
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
  const [view, setView] = useState<View>('record')
  const [selectedDate, setSelectedDate] = useState(getSundayInKampala())
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [summaries, setSummaries] = useState<SalesSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
    if (!supabase || !session) return
    let active = true
    setHistoryLoading(true)
    supabase.from('sales_summaries')
      .select('*, recorder:profiles!sales_summaries_recorded_by_fkey(display_name,email)')
      .order('sunday_date', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) setError(`Could not load saved summaries. ${loadError.message}`)
        else setSummaries((data || []) as SalesSummary[])
        setHistoryLoading(false)
      })
    return () => { active = false }
  }, [session])

  const selectedSummary = useMemo(() => summaries.find((summary) => summary.sunday_date === selectedDate), [summaries, selectedDate])
  useEffect(() => {
    if (!selectedDate) return
    setForm(selectedSummary ? {
      ids_printed: String(selectedSummary.ids_printed),
      mtn_amount: String(selectedSummary.mtn_amount),
      airtel_amount: String(selectedSummary.airtel_amount),
      expenses: String(selectedSummary.expenses),
      cash_deposited: String(selectedSummary.cash_deposited),
    } : emptyForm)
    setError('')
    setNotice('')
  }, [selectedSummary, selectedDate])

  const ids = amountOrZero(form.ids_printed)
  const mtn = amountOrZero(form.mtn_amount)
  const airtel = amountOrZero(form.airtel_amount)
  const expenses = amountOrZero(form.expenses)
  const deposited = amountOrZero(form.cash_deposited)
  const worked = mtn + airtel + deposited
  const cashAtHand = deposited - expenses
  const validSunday = isSunday(selectedDate)

  function setValue(key: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
    setNotice('')
  }

  async function loadSummary(summary: SalesSummary) {
    setSelectedDate(summary.sunday_date)
    setView('record')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session) return
    if (!validSunday) { setError('Choose a Sunday to save this summary.'); return }
    setSaving(true)
    setError('')
    setNotice('')
    const draft: SalesDraft = {
      sunday_date: selectedDate,
      ids_printed: Math.floor(ids),
      mtn_amount: mtn,
      airtel_amount: airtel,
      expenses,
      cash_deposited: deposited,
    }
    const { data, error: saveError } = await supabase.from('sales_summaries')
      .upsert({ ...draft, recorded_by: session.user.id }, { onConflict: 'sunday_date' })
      .select('*, recorder:profiles!sales_summaries_recorded_by_fkey(display_name,email)')
      .single()
    setSaving(false)
    if (saveError) {
      setError(saveError.message.includes('sales_summaries') ? 'Could not save the summary. Check that the Supabase setup SQL has been applied.' : saveError.message)
      return
    }
    setSummaries((current) => [data as SalesSummary, ...current.filter((item) => item.sunday_date !== selectedDate)].sort((a, b) => b.sunday_date.localeCompare(a.sunday_date)))
    setNotice(`Summary for ${formatSunday(selectedDate)} saved.`)
  }

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
  }

  if (!supabaseConfigured) return <SetupScreen />
  if (!authReady) return <main className="loading-screen"><LoaderCircle className="spin" size={20} /><span>Connecting securely…</span></main>
  if (!session) return <SignIn onSignedIn={setSession} />

  const currentUserName = displayName(session.user)
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Sunday Close home"><span className="brand-mark"><ChartNoAxesCombined size={18} /></span><span>Sunday close</span></a>
        <div className="account"><span className="user-avatar" aria-hidden="true">{currentUserName.slice(0, 1).toUpperCase()}</span><span className="account-name">{currentUserName}</span><Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out"><LogOut size={16} /><span className="signout-label">Sign out</span></Button></div>
      </header>

      <section className="page-heading" id="main">
        <div><div className="eyebrow">Weekly record</div><h1>Sales summary</h1><p>Record this Sunday’s figures and review the closing balance.</p></div>
        <div className="heading-date"><span className="date-dot" />Sunday sales</div>
      </section>

      <nav className="tabs" aria-label="Sales summary sections">
        <button className={view === 'record' ? 'tab active' : 'tab'} onClick={() => setView('record')}><ArrowDownLeft size={15} />Record sales</button>
        <button className={view === 'history' ? 'tab active' : 'tab'} onClick={() => setView('history')}><ClipboardList size={15} />Past Sundays <span className="tab-count">{summaries.length}</span></button>
      </nav>

      {error && <div className="global-message"><ErrorNotice>{error}</ErrorNotice><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="global-message"><div className="notice notice-success" role="status"><BadgeCheck size={16} />{notice}</div><button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

      {view === 'record' ? (
        <div className="main-grid">
          <Card className="entry-card">
            <CardHeader className="entry-header"><div><CardTitle>Enter Sunday’s figures</CardTitle><p>Enter amounts in Ugandan shillings.</p></div>{selectedSummary && <Badge>Saved</Badge>}</CardHeader>
            <CardContent>
              <form onSubmit={saveSummary}>
                <div className="field date-field"><Label htmlFor="sunday-date">Sunday date</Label><Input id="sunday-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-describedby={!validSunday ? 'date-error' : undefined} /></div>
                {!validSunday && <p className="field-error" id="date-error">Please select a Sunday.</p>}
                <div className="fields-grid">
                  <div className="field"><Label htmlFor="ids-printed">IDs printed</Label><Input id="ids-printed" type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={form.ids_printed} onChange={(event) => setValue('ids_printed', event.target.value)} /><span className="field-hint">Number of IDs issued</span></div>
                  <MoneyField id="mtn-amount" label="MTN Mobile Money" value={form.mtn_amount} onChange={(value) => setValue('mtn_amount', value)} />
                  <MoneyField id="airtel-amount" label="Airtel Money" value={form.airtel_amount} onChange={(value) => setValue('airtel_amount', value)} />
                  <MoneyField id="expenses" label="Total expenses" value={form.expenses} onChange={(value) => setValue('expenses', value)} />
                  <MoneyField id="cash-deposited" label="Cash deposited" value={form.cash_deposited} onChange={(value) => setValue('cash_deposited', value)} />
                </div>
                <div className="form-note"><CircleHelp size={15} /><span>IDs are recorded as a count. Expenses are deducted from physical cash to calculate cash at hand.</span></div>
                <Button type="submit" className="save-button" disabled={saving || !validSunday}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{selectedSummary ? 'Update summary' : 'Save Sunday summary'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="summary-card" aria-live="polite">
            <CardHeader className="summary-header"><CardTitle>Closing summary</CardTitle><Badge className="badge-live">LIVE</Badge></CardHeader>
            <CardContent>
              <div className="metric-label">Total amount worked</div><div className="worked-total">{formatMoney(worked)}</div><div className="metric-support">{formatMoney(mtn)} mobile money <span>·</span> {formatMoney(deposited)} cash</div>
              <div className="summary-divider" />
              <div className="balance-row"><div><div className="metric-label">Cash at hand</div><div className={cashAtHand < 0 ? 'balance-status status-warning' : 'balance-status'}><span className="status-dot" />{cashAtHand < 0 ? 'Expenses exceed cash deposited' : 'After expenses'}</div></div><div className={cashAtHand < 0 ? 'balance-value negative' : 'balance-value'}>{formatMoney(cashAtHand)}</div></div>
              <div className="breakdown"><h3>Money received</h3><div className="breakdown-row"><span>MTN Mobile Money</span><strong>{formatMoney(mtn)}</strong></div><div className="breakdown-row"><span>Airtel Money</span><strong>{formatMoney(airtel)}</strong></div><div className="breakdown-row"><span>Cash deposited</span><strong>{formatMoney(deposited)}</strong></div><div className="breakdown-row deduction"><span>Expenses</span><strong>− {formatMoney(expenses)}</strong></div></div>
              <div className="formula">Total worked = MTN + Airtel + cash deposited<br />Cash at hand = cash deposited − expenses</div>
              <div className="recorded-by"><span className="recorded-avatar">{(selectedSummary?.recorder?.display_name || selectedSummary?.recorder?.email || currentUserName).slice(0, 1).toUpperCase()}</span><span>{selectedSummary ? <>Recorded by <strong>{selectedSummary.recorder?.display_name || selectedSummary.recorder?.email || 'Team cashier'}</strong></> : <>Will be recorded by <strong>{currentUserName}</strong></>}</span></div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="history-card">
          <CardHeader className="history-header"><div><CardTitle>Past Sundays</CardTitle><p>Saved sales summaries, newest first.</p></div><span className="history-total">{summaries.length} {summaries.length === 1 ? 'record' : 'records'}</span></CardHeader>
          {historyLoading ? <div className="history-loading"><LoaderCircle className="spin" size={18} />Loading summaries…</div> : summaries.length === 0 ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={21} /></div><h3>No summaries saved yet</h3><p>Save a Sunday’s sales figures and they’ll appear here.</p><Button variant="outline" onClick={() => setView('record')}>Record sales</Button></div> : (
            <div className="history-list">
              <div className="history-grid history-labels"><span>Sunday</span><span>IDs</span><span>Total worked</span><span>Cash at hand</span><span>Recorded by</span><span /></div>
              {summaries.map((summary) => {
                const total = summary.mtn_amount + summary.airtel_amount + summary.cash_deposited
                const balance = summary.cash_deposited - summary.expenses
                const cashier = summary.recorder?.display_name || summary.recorder?.email || 'Team cashier'
                return <button className="history-grid history-item" key={summary.sunday_date} onClick={() => loadSummary(summary)} aria-label={`Open ${formatSunday(summary.sunday_date)} summary, recorded by ${cashier}`}>
                  <span className="history-date">{formatSunday(summary.sunday_date)}</span><span>{summary.ids_printed.toLocaleString('en-UG')}</span><strong>{formatMoney(total)}</strong><strong className={balance < 0 ? 'negative' : ''}>{formatMoney(balance)}</strong><span className="history-cashier"><span className="cashier-avatar">{cashier.slice(0, 1).toUpperCase()}</span>{cashier}</span><ArrowRight className="history-arrow" size={16} />
                </button>
              })}
            </div>
          )}
        </Card>
      )}
      <footer className="page-footer"><span>Sunday Close · Sales record</span><span><ShieldCheck size={13} /> Team data is private</span></footer>
    </main>
  )
}

export default App
