# Capability Seed — Humanity × dkPlus (the 45)

> The user's verbatim seed corpus for the composer ("What can Sókrates do for you?").
> Each item is ONE cross-system automation Sókrates can compose: a pain it answers,
> the source/target systems, the transform, the business value, and the real surface
> areas it touches. This is the source the typed `Capability[]` corpus (`corpus.ts`)
> is built from, grounded against the real endpoint/model evidence index
> (`data/evidence/*.json`). Humanity = scheduling/time side; dkPlus = ERP/finance side.

1. **Approved timeclock → payroll/work-journal posting** — Pull approved Humanity
   timeclocks, normalize them by employee, position, location, overtime rules, break
   events, tips, and dates, then post them into dkPlus employee work journals or cost
   entries. Turns time approval into accounting/project labor capture without manual
   payroll prep. Humanity has timeclock read/write/event approval surfaces; dkPlus has
   employee work journal and cost journal endpoints.

2. **Schedule → labor cost forecast** — Take future Humanity shifts, enrich them with
   dkPlus employee cost rates, dimensions, projects, departments, and customer/job
   data, then forecast labor cost by day, week, project, location, and GL dimension. A
   live "what will this schedule cost?" view before labor is committed. Humanity shifts
   support employee, schedule, location, detailed, budget, skill, and vacation filters.

3. **Labor variance engine: scheduled vs actual vs paid** — Compare Humanity scheduled
   shifts, actual clocked time, and dkPlus payroll/payslip or work-journal output. Flag
   early/late clock-ins, missed breaks, overtime drift, unapproved time,
   paid-but-unscheduled labor, and scheduled-but-never-worked labor. One of the
   cleanest ways to find leakage quickly.

4. **Project/job costing from shifts** — Map Humanity positions/locations/shifts to
   dkPlus projects, phases, tasks, and project requests. When work happens, post hours
   directly to the right dkPlus project work journal. Near-real-time gross margin by
   job instead of waiting for payroll/accounting cleanup. dkPlus exposes projects,
   project requests, phases, tasks, and employee work journals.

5. **Auto-invoice billable labor** — For billable work, convert approved Humanity time
   into dkPlus sales invoices, sales orders, or project invoices using agreed rates,
   customer contracts, product/service codes, dimensions, and invoice references. Add
   invoice PDFs/emails automatically after approval. dkPlus has invoice create, bulk
   create, invoice reference lookup, invoice PDF/HTML/email, and project invoice
   endpoints.

6. **Customer/project demand → schedule generation** — Look at dkPlus projects, project
   requests, POS orders, sales orders, subscriptions, or customer demand, then create
   the needed Humanity shifts by skill, location, worker count, and due date. The "ERP
   tells scheduling what labor is needed" loop.

7. **Availability-aware staffing recommendations** — Use Humanity availability, future
   availability, weekly availability, skills, and position assignments to recommend who
   should staff dkPlus project requests or customer jobs. Rank candidates by
   availability, skill fit, overtime risk, distance/location, cost, and recent
   utilization. Humanity exposes availability date-period queries and approval/rejection
   flows.

8. **Overtime prevention before schedules publish** — Before publishing Humanity
   shifts, simulate each employee's weekly/monthly/daily overtime exposure and compare
   against dkPlus cost centers/project budgets. Suggest cheaper compliant alternatives.
   Humanity employee records include overtime/pay-type fields; shifts can be fetched
   with budget/detailed data.

9. **Auto-create and update employees across both systems** — When a worker is
   created/updated/terminated in dkPlus, create/update/deactivate them in Humanity with
   matching email, employee ID, location, position, pay type, start date, skills, and
   timezone. Reverse-sync Humanity changes back only where Humanity is the source of
   truth. Humanity supports employee create/update and assigning positions/skills;
   dkPlus supports employee create/update/get.

10. **Position ↔ project task mapping** — Keep Humanity positions aligned with dkPlus
    project tasks, phases, departments, dimensions, or service categories. e.g.
    "Installation Tech" → dkPlus task "INSTALL", GL dimension "Field Ops", invoice item
    "LABOR-INSTALL". Makes downstream payroll, invoicing, and reporting clean.

11. **Budget guardrails at schedule creation** — When a manager creates a Humanity
    shift, the tool checks dkPlus project/customer budget, open purchase orders,
    already-booked labor, invoice status, and margin target. It can allow, warn, or
    route for approval when the shift would blow budget.

12. **Real-time margin dashboard by location/project/customer** — Combine Humanity
    scheduled/actual hours with dkPlus revenue, invoices, product cost, project
    transactions, and GL entries. Show margin by store, job, customer, team, and
    manager. Executive-grade: "Where are we making money this week, and where are we
    bleeding?"

13. **Unbilled labor detector** — Find approved Humanity timeclocks or completed shifts
    attached to billable dkPlus projects/customers that have not yet been invoiced.
    Create draft invoices or queue billing review. Catches a common service-business
    leak.

14. **Payroll exception copilot** — Before payroll closes, scan Humanity and dkPlus for
    missing clock-outs, overlapping shifts, duplicated time, unapproved timeclocks,
    clocked time with no employee mapping, employees missing pay type, incorrect
    position, no dkPlus employee number, and suspicious GPS/IP/location events. Fix what
    can be safely fixed and route the rest.

15. **Automatic GL accruals for labor** — At month-end, accrue labor from Humanity
    approved or scheduled hours into dkPlus GL journals by cost center/project/location
    before payroll is finalized. Reverse accruals once actual payroll posts. dkPlus
    exposes GL account/transaction/journal endpoints.

16. **Shift-to-inventory planning** — For retail, restaurants, field service, or
    production: use upcoming Humanity shifts and dkPlus recipes/product
    demand/inventory to predict required inventory, then create purchase orders or
    transfers. If staffing indicates a busy weekend, stock moves before the rush.

17. **Inventory transfer based on staffing/location** — If Humanity shows extra
    staffing at Location A and shortage at Location B, or an event/project is scheduled
    at a remote site, create dkPlus inventory transfers to stage
    products/tools/materials at the right warehouse/location. dkPlus exposes product
    inventory transfers, inventory journals, product groups, and product warehouse
    operations.

18. **POS demand → labor demand feedback loop** — Pull dkPlus POS orders/sales
    patterns, feed demand drivers into Humanity forecast or demand-driven scheduling,
    and create recommended shift coverage. Especially valuable for retail/hospitality.

19. **Invoice pricing validation against labor reality** — Before creating dkPlus
    invoices, check whether quoted/billed labor units match Humanity actual hours. If
    the quote says 12 hours and Humanity shows 18, flag it. For fixed-price contracts,
    quantify margin erosion.

20. **Project request scheduling assistant** — Take dkPlus project requests with status,
    worker, supervisor, customer, From/To, priority, worker count, and scheduling
    status, then create or adjust Humanity shifts. Update the dkPlus request as
    scheduled, in progress, arrived, finished, ready to bill, or billed based on
    Humanity shift/timeclock state.

21. **Absence/leave impact analyzer** — When Humanity leave or availability changes are
    approved, inspect dkPlus projects/orders due in that window, identify customer
    commitments at risk, and suggest replacements or reschedule work.

22. **Customer SLA breach prevention** — Use dkPlus project/customer/order due dates and
    Humanity staffing coverage to detect "we don't have enough qualified labor to meet
    this obligation." Notify managers before the SLA is missed.

23. **Training-gated scheduling** — Use Humanity training progress and skill assignments
    to prevent untrained employees from being scheduled onto dkPlus
    jobs/products/services requiring certification. High-value compliance for regulated
    businesses.

24. **Worker utilization and bench reporting** — Combine dkPlus employee project
    assignments with Humanity scheduled/actual hours to show utilization by worker:
    billable, non-billable, overtime, admin, idle, absent, training, travel. Very
    useful for service firms.

25. **Automated shift publishing from approved ERP demand** — When a dkPlus sales
    order/project request reaches "approved"/"ready", automatically create draft
    Humanity shifts. When the manager approves the draft, publish shifts and notify
    workers.

26. **Two-way employee identity resolver** — Build a durable mapping layer across
    Humanity employee ID, Humanity unique ID/EID, dkPlus employee number, email, phone,
    username, payroll identity, and sales/project worker identity. This boring layer
    unlocks almost every automation above.

27. **Duplicate and stale master-data cleanup** — Continuously detect mismatched
    employees, duplicate customers, orphaned project workers, unused positions, inactive
    employees still scheduled, terminated employees still in dkPlus, and Humanity
    positions with no accounting mapping.

28. **Approval workflow unification** — One approval cockpit for time, work journals,
    project labor, vendor invoices, schedule exceptions, leave, overtime, and billing.
    Reads pending items in both systems, prioritizes by money/risk, and pushes approved
    outcomes back to the right API.

29. **Manager daily operating brief** — Every morning: "Here are today's shifts, open
    project requests, employees at risk of overtime, missing materials, customer work
    due, unapproved time, invoices ready to send, and jobs likely to miss margin." Low
    implementation risk, high perceived value.

30. **End-of-day close bot** — At day close: verify everyone clocked out, reconcile
    shifts to timeclocks, post work-journal entries, update project statuses, flag
    unbilled labor, check inventory movements, and send a summary to managers.

31. **Tips, breaks, and compliance reconciliation** — Humanity timeclock events include
    break, notes, location, position, GPS, and tips-style event data. Convert those into
    payroll, project, or accounting records in dkPlus; route exceptions for review.

32. **Labor-backed quote generation** — When creating dkPlus quotes, estimate labor from
    historical Humanity shifts/timeclocks for similar customers/projects/positions.
    Suggest quote line items and expected margin.

33. **Actual-cost quote improvement loop** — After a job closes, compare quoted labor vs
    scheduled labor vs actual clocked labor vs invoiced labor. Feed the variance back
    into dkPlus quote templates and Humanity staffing assumptions.

34. **Automated customer communication** — Use dkPlus customer/project/order state plus
    Humanity staffing changes to send customer-facing updates: "technician scheduled,"
    "crew en route," "job completed," "invoice ready," "delay due to reschedule." For
    internal teams, use Humanity messages/notices/wall messages. Humanity exposes
    messaging/wall/notices endpoints.

35. **Location and warehouse alignment** — Keep Humanity locations/remote sites aligned
    with dkPlus warehouses, departments, dimensions, POS locations, and project sites.
    Reduces reporting chaos; enables location-level labor + inventory + sales
    profitability.

36. **Demand-based hiring signals** — Aggregate recurring Humanity understaffing, open
    shifts, overtime, rejected availability, and dkPlus missed revenue/project delays.
    Recommend hiring by role/location: "You need 1.7 FTE more in Reykjavík warehouse
    afternoons."

37. **Skill gap heatmap** — Compare dkPlus project demand by task/product/service
    against Humanity skills and positions. Show where certifications or skills are
    bottlenecking revenue.

38. **Subscription/service-plan staffing** — For dkPlus recurring subscriptions or
    recurring customer work, pre-build recurring Humanity coverage and auto-adjust for
    holidays, availability, and projected overtime.

39. **Vendor invoice approval context** — When a dkPlus vendor invoice comes in for temp
    labor, tools, materials, or subcontractors, attach Humanity evidence: scheduled
    labor, actual hours, job status, inventory use, and project/customer. Faster, less
    blind approvals.

40. **Fraud/anomaly detection** — Flag suspicious patterns: clock-ins from wrong
    location, repeated manual edits, timeclock without matching shift, payroll entries
    without approved Humanity time, dkPlus work journal posted for a non-scheduled
    employee, or unusually high labor on low-revenue jobs.

41. **Revenue-per-labor-hour optimization** — Join dkPlus sales/invoice/POS revenue with
    Humanity actual labor hours. Rank locations, shifts, managers, roles, and dayparts
    by revenue per labor hour and gross margin per labor dollar.

42. **Auto-create open shifts from sales spikes** — If dkPlus POS/sales-order volume
    crosses thresholds, create Humanity open shifts or recommend shift extensions.
    Conversely, if demand collapses, suggest voluntary early clock-outs or schedule
    reductions.

43. **Customer profitability with labor attribution** — For each dkPlus customer,
    calculate revenue, product cost, billed labor, unbilled labor, support/project
    labor, travel/idle time, and discounts. Humanity supplies labor reality; dkPlus
    supplies financial reality.

44. **Operational "single command bar"** — A manager types: "Staff the Jónsson install
    next Tuesday with the cheapest qualified available crew and keep everyone under 40
    hours." The tool inspects dkPlus project/customer/task data, Humanity
    availability/skills/overtime, creates shifts, and updates the project request.

45. **Company-wide integration health monitor** — Continuously test API connectivity,
    sync lag, unmapped IDs, failed writes, duplicate references, orphan records,
    permission failures, and stale modified timestamps. dkPlus exposes
    company status/sync/connection endpoints; Humanity has updated-at filters on several
    resources.
