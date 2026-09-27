# Automated Previous-Month Summary on Dashboard

A dedicated, automated monthly financial intelligence card displayed prominently on the Dashboard during the start of each new month (first 7 days) to aggregate previous month dues, collections, net cash flow balance, and comparative growth against the prior month, complete with one-click PDF/CSV exports and customer breakdowns.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters have been confirmed based on your preferences:
> - **Display Timing**: Automatically displayed on the Dashboard during the first 7 days of each month (`day <= 7`), with a one-click dismiss option stored in local preferences for that month. To ensure you can test and review past performance anytime, an on-demand "View Monthly Summary" toggle is also provided.
> - **Export & Breakdown Actions**: Integrated one-click PDF statement export and CSV data download for the previous month, along with an expandable breakdown showing the top debtor and creditor movements during that period.
> - **Month-over-Month Comparison**: Comparative badge and percentage delta for both dues and collections compared to the month prior (e.g. August vs July when in September), indicating business growth or debt accumulation trends.
> - **Strict Style Discipline**: 100% flat solid styling with zero color gradients, using tabular numerals for all monetary values and high-contrast typography.

---

### 1. Overview & Core Concept

- **What It Does**: At the beginning of every month, small business owners and shopkeepers need an effortless accounting wrap-up of how their business performed in the preceding calendar month. This feature automatically compiles all transactions from the previous month, computes total credit extended (dues), total cash collected (payments), and the net balance. It presents these in an elegant, dismissible banner card right on the Dashboard.
- **Target Audience / Persona**: Shop owners, ledger administrators, and cashiers using TakaTrek / Digital Khata who need monthly accounting reports without manually filtering through raw logs.
- **Key Value**: Replaces tedious manual ledger calculation at month-end with an automated executive snapshot, preventing lost receivables and providing instant exportable documentation.

---

### 2. User Experience & Visual Design

#### A. Key User Flows
1. **Automated Discovery**: When an owner opens the app between the 1st and 7th day of any month, an alert card titled **"Previous Month Summary" (পূর্ববর্তী মাসের হিসাব বিবরণী)** appears directly above the daily totals on the Dashboard.
2. **Glanceable Metrics**:
   - **Total Collections (মোট আদায়)**: Green solid badge with total cash received.
   - **Total Dues (নতুন বাকি প্রদান)**: Rose solid badge with total credit given.
   - **Net Balance (নিট ক্যাশ ব্যালেন্স)**: Net cash flow with clear indication (Surplus vs Deficit).
   - **Month-over-Month Deltas**: Concise percentage change comparing collections and dues against the month before (e.g., `+12.4% vs July`).
3. **One-Click Actions**:
   - **Download PDF**: Generates a branded monthly PDF statement ready for printing or sharing.
   - **Export CSV**: Downloads structured tabular rows of the entire month's entries for accounting in Excel or Google Sheets.
   - **Toggle Breakdown**: Expandable drawer showing transaction volume and top 5 customer accounts active in that month.
4. **Dismiss / Reopen**:
   - Dismissing the card hides it for the rest of the current month.
   - A quiet header action or "View Past Month Summary" control allows reopening the card at any time.

#### B. Visual Theme & Layout (Zero Gradients)
- **Palette & Cards**:
  - Light mode: Pure flat white canvas (`#FFFFFF`), solid border (`#E4E4E7`), solid emerald (`#16A34A`), solid rose (`#E11D48`), neutral dark slate (`#18181B`).
  - Dark mode: Deep neutral slate (`#18181B`), solid borders (`#27272A`), high-contrast muted text (`#A1A1AA`).
  - **Zero Gradients**: No CSS linear gradients or Tailwind `bg-gradient-*` classes.
- **Typography & Numerical Discipline**:
  - Display titles: Crisp `font-bold` tracking-tight text with Bengali and English support.
  - Figures: Monospaced tabular numerals (`font-mono tabular-nums`) so currency and percent metrics align cleanly without layout jitter.
- **Micro-Interactions**:
  - Smooth Framer Motion entrance (`opacity: 0, y: -6` to `opacity: 1, y: 0`).
  - Haptic feedback tick on export and dismiss buttons.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dynamic Date Math vs Backend Scheduled Job**:
  - *Chosen Approach*: Pure client-side dynamic date aggregation using the already cached transactions list from Firestore / IndexedDB offline store.
  - *Why*: Instant computation without recurring cloud functions or server costs. Works 100% offline even if the owner has no network connection on the 1st of the month.
  - *Alternatives Considered*: Firebase scheduled cloud function writing to a `monthly_summaries` collection. Discarded because it fails when offline and adds unnecessary cloud infrastructure overhead for a client-driven ledger.

- **Decision 2: Persistent Dismissal State**:
  - *Chosen Approach*: Storing dismissed state per month in `localStorage` under `monthly_summary_dismissed_${year}_${month}`.
  - *Why*: Prevents annoying the user after they have reviewed their monthly figures, while ensuring the card automatically reappears next month.

- **Decision 3: Dedicated PDF & CSV Generation**:
  - *Chosen Approach*: Implement `exportMonthlyTransactionsToPDF` and `exportMonthlyTransactionsToCSV` in `src/lib/exportUtils.ts` with branded Bengali/English headers, transaction summaries, and itemized customer rows.
  - *Why*: High-resolution client-side canvas and jsPDF rendering ensures immediate downloads without network round-trips.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       useLedger Hook                        │
│             (Transactions & Customers State)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 MonthlySummaryCard Component                │
│  - Checks current day (1st-7th or manual toggle)            │
│  - Filters transactions for Previous Month (M-1)            │
│  - Filters transactions for Prior Month (M-2) for delta %   │
│  - Computes Total Dues, Collections, Net Balance            │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Stat Grid   │       │  Expandable  │       │ One-Click    │
│  - Dues      │       │  Customer    │       │ Exports      │
│  - Paid      │       │  Breakdown   │       │ - CSV Engine │
│  - Net Delta │       │  List        │       │ - PDF Engine │
└──────────────┘       └──────────────┘       └──────────────┘
```

#### Proposed Component & Utility Implementation:
1. **`src/components/MonthlySummaryCard.tsx`**:
   - Encapsulates previous month boundary calculations (`startOfPrevMonth`, `endOfPrevMonth`, `startOfPriorMonth`, `endOfPriorMonth`).
   - Computes stats: `dues`, `collections`, `netBalance`, `txCount`, `debtorsCount`.
   - Computes MoM deltas: `duesChangePct`, `collectionsChangePct`.
   - Handles dismiss state (`localStorage`) and expand/collapse details.
   - Provides trigger buttons for CSV and PDF exports.
2. **`src/lib/exportUtils.ts`**:
   - Add `exportMonthlyTransactionsToCSV` and `exportMonthlyTransactionsToPDF` functions formatted for full month statements.
3. **`src/components/Dashboard.tsx`**:
   - Mount `<MonthlySummaryCard />` at the top of the Overview tab with option to toggle view.
4. **`src/lib/translations.ts`**:
   - Add localized bilingual keys for both Bangla and English (e.g. `previousMonthSummary`, `netBalance`, `lastMonthComparison`, `vsPriorMonth`).
