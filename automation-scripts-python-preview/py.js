/* automation scripts — builds the Python file with the buyer's settings written in. Python 3.8+, standard library only (no pip install). */
(function (root) {
  'use strict';
  var COMMON = String.raw`
import csv, datetime, json, os, re, sys

def sniff(text):
    line = text.split("\n")[0] if text else ""
    q = False; c = {",": 0, ";": 0, "\t": 0}
    for ch in line:
        if ch == '"': q = not q
        elif not q and ch in c: c[ch] += 1
    best, n = ",", c[","]
    if c[";"] > n: best, n = ";", c[";"]
    if c["\t"] > n: best = "\t"
    return best

def read_table(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        text = f.read()
    d = sniff(text)
    rows = [r for r in csv.reader(text.splitlines(), delimiter=d) if any(str(x).strip() for x in r)]
    if not rows:
        sys.exit("The file is empty: " + path)
    return [h.strip() for h in rows[0]], rows[1:]

def col(headers, name, need=True):
    if not name:
        return -1
    for i, h in enumerate(headers):
        if h.strip().lower() == name.strip().lower():
            return i
    if need:
        sys.exit("Column '%s' is not in the file. Columns found: %s" % (name, ", ".join(headers)))
    return -1

def cell(r, i):
    return str(r[i]).strip() if 0 <= i < len(r) else ""

def cents(x):
    import math
    return -int(math.floor(-x * 100 + 0.5)) if x < 0 else int(math.floor(x * 100 + 0.5))

def money(s):
    s = str(s or "").strip()
    if not s:
        return None
    neg = bool(re.match(r"^\(.*\)$", s) or re.match(r"^-|^[^\d]*-", s) or s.endswith("-"))
    t = re.sub(r"[^\d.,]", "", s)
    if not re.search(r"\d", t):
        return None
    c, p = t.rfind(","), t.rfind(".")
    if c >= 0 and p >= 0:
        t = t.replace(".", "").replace(",", ".", 1) if c > p else t.replace(",", "")
    elif c >= 0:
        t = t.replace(",", ".") if (re.search(r",\d{1,2}$", t) and t.count(",") == 1) else t.replace(",", "")
    elif p >= 0 and t.count(".") > 1:
        t = t.replace(".", "")
    try:
        v = float(t)
    except ValueError:
        return None
    return (-1 if neg else 1) * cents(v) / 100

def date_of(s, fmt="auto"):
    s = re.split(r"[\sT]", str(s or "").strip())[0]
    if not s:
        return None
    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = re.match(r"^(\d{1,2})([-/.])(\d{1,2})[-/.](\d{2}|\d{4})$", s)
        if not m:
            return None
        a, b, y = int(m.group(1)), int(m.group(3)), int(m.group(4))
        if y < 100: y += 2000
        f = fmt if fmt in ("dmy", "mdy") else ("dmy" if (m.group(2) == "." or a > 12) else "mdy")
        d, mo = (a, b) if f == "dmy" else (b, a)
    try:
        return datetime.date(y, mo, d)
    except ValueError:
        return None

def usd(x):
    c = cents(x); neg = c < 0; c = abs(c)
    return ("-$" if neg else "$") + "{:,}".format(c // 100) + "." + "%02d" % (c % 100)

def safe_name(s):
    s = re.sub(r"\s+", "_", re.sub(r"[^A-Za-z0-9 ._-]+", "", str(s or "")).strip())
    return (s or "blank")[:60]

def write_csv(path, headers, rows):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\r\n"); w.writerow(headers); w.writerows(rows)

def out_dir(src):
    base = os.path.splitext(os.path.abspath(src))[0] + "_out"
    os.makedirs(base, exist_ok=True)
    return base

def done(summary, lines):
    if "--json" in sys.argv:
        print(json.dumps(summary, ensure_ascii=False))
    else:
        print("\n".join(lines))
`;

  var BODY = {};
  BODY.overdue = String.raw`
BUCKETS = [(1, 30), (31, 60), (61, 90), (91, 10 ** 9)]
BNAME = ["1-30 days", "31-60 days", "61-90 days", "91+ days"]
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def nice(d):
    return "%s %d, %d" % (MON[d.month - 1], d.day, d.year)

def reminder(client, lst):
    tot = sum(cents(o["owed"]) for o in lst) / 100
    worst = max(o["days_late"] for o in lst)
    subj = ("Invoice %s is %d days past due" % (lst[0]["invoice"], worst)) if len(lst) == 1 else ("%d invoices past due, %s in total" % (len(lst), usd(tot)))
    if worst > 60: opening = "This is a final reminder before I pause further work on your account."
    elif worst > 30: opening = "I have not yet received payment for the invoice(s) below and would be grateful if you could settle them this week."
    else: opening = "A quick reminder that the invoice(s) below are now past their due date."
    lines = ["- %s: %s, due %s (%d days ago)" % (o["invoice"], usd(o["owed"]), nice(o["due"]), o["days_late"]) for o in lst]
    return ("Subject: " + subj + "\n\nHello " + client + ",\n\n" + opening + "\n\n" + "\n".join(lines) + "\n\nTotal now due: " + usd(tot) + "\n"
            + ("\n" + S["paynote"] + "\n" if S.get("paynote") else "") + "\nThank you,\n" + (S.get("yourname") or "") + "\n")

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("Usage: python overdue_invoices.py invoices.csv   (add --asof 2026-11-18 to check another day)")
    asof = datetime.date.today()
    if "--asof" in sys.argv:
        asof = date_of(sys.argv[sys.argv.index("--asof") + 1]); args = [a for a in args if a != sys.argv[sys.argv.index("--asof") + 1]]
    elif S.get("asof_fixed"):
        asof = date_of(S["asof_fixed"])
    headers, rows = read_table(args[0])
    C = S["columns"]
    ia, idue, ipaid, iap = col(headers, C["amount"]), col(headers, C["due"]), col(headers, C.get("paid"), False), col(headers, C.get("amount_paid"), False)
    iinv, icl, iem = col(headers, C.get("invoice"), False), col(headers, C.get("client"), False), col(headers, C.get("email"), False)
    out, opn, skipped = [], [], 0
    for ix, r in enumerate(rows):
        amt, due = money(cell(r, ia)), date_of(cell(r, idue), S["datefmt"])
        if amt is None or due is None:
            skipped += 1; continue
        if iap >= 0:
            owed = cents(amt - (money(cell(r, iap)) or 0)) / 100
        else:
            owed = 0 if cell(r, ipaid) else amt
        if owed <= 0:
            continue
        late = (asof - due).days
        o = {"invoice": cell(r, iinv) or "line %d" % (ix + 2), "client": cell(r, icl) or "(no client)", "email": cell(r, iem),
             "due": due, "amount": amt, "owed": owed, "days_late": late}
        if late > int(S.get("grace") or 0):
            b = next(i for i, (lo, hi) in enumerate(BUCKETS) if lo <= late <= hi)
            o["bucket"] = BNAME[b]
            o["next"] = due + datetime.timedelta(days=BUCKETS[b + 1][0]) if b < 3 else None
            out.append(o)
        else:
            opn.append(o)
    out.sort(key=lambda o: (-o["days_late"], o["invoice"]))
    bc = [0, 0, 0, 0]; clients = {}
    for o in out:
        bc[BNAME.index(o["bucket"])] += cents(o["owed"])
        clients.setdefault(o["client"], []).append(o)
    nexts = sorted([o for o in out if o["next"]], key=lambda o: o["next"])
    total = sum(bc)
    od = out_dir(args[0])
    write_csv(os.path.join(od, "overdue_report.csv"), ["Invoice", "Client", "Email", "Due date", "Amount", "Still owed", "Days late", "Bucket", "Enters next bucket"],
              [[o["invoice"], o["client"], o["email"], o["due"].isoformat(), "%.2f" % o["amount"], "%.2f" % o["owed"], o["days_late"], o["bucket"],
                o["next"].isoformat() if o["next"] else ""] for o in out])
    os.makedirs(os.path.join(od, "reminders"), exist_ok=True)
    for c, lst in clients.items():
        with open(os.path.join(od, "reminders", safe_name(c) + ".txt"), "w", encoding="utf-8") as f:
            f.write(reminder(c, lst))
    summary = {"overdue_total": total / 100, "overdue_count": len(out), "clients": len(clients), "reminders": len(clients),
               "oldest_days": out[0]["days_late"] if out else 0, "oldest_invoice": out[0]["invoice"] if out else "",
               "b1_30": bc[0] / 100, "b31_60": bc[1] / 100, "b61_90": bc[2] / 100, "b91": bc[3] / 100, "over_60": (bc[2] + bc[3]) / 100,
               "not_due_total": sum(cents(o["owed"]) for o in opn) / 100, "not_due_count": len(opn), "skipped": skipped,
               "next_date": nexts[0]["next"].isoformat() if nexts else "", "next_invoice": nexts[0]["invoice"] if nexts else "",
               "next_days": (nexts[0]["next"] - nexts[0]["due"]).days if nexts else 0}
    lines = ["Checked %d invoices on %s." % (len(rows), nice(asof)),
             "Overdue: %s on %d invoices from %d clients (over 60 days: %s)." % (usd(total / 100), len(out), len(clients), usd((bc[2] + bc[3]) / 100))]
    for o in out:
        lines.append("  %-10s %-24s %12s  %3d days late" % (o["invoice"], o["client"][:24], usd(o["owed"]), o["days_late"]))
    lines.append("Report and %d reminder drafts written to %s" % (len(clients), od))
    done(summary, lines)
`;
  BODY.dedupe = String.raw`
EMAIL_RX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("Usage: python dedupe_contacts.py contacts.csv")
    headers, rows = read_table(args[0])
    C = S["columns"]
    ie, ip = col(headers, C["email"]), col(headers, C.get("phone"), False)
    seen, keep, dups = {}, [], []
    invalid = blank = filled = 0
    for ix, r in enumerate(rows):
        e = cell(r, ie).lower(); key = ""
        if not e: blank += 1
        elif not EMAIL_RX.match(e): invalid += 1
        else: key = "e:" + e
        if not key and S.get("phone") and ip >= 0:
            ph = re.sub(r"\D", "", cell(r, ip))[-10:]
            if len(ph) >= 7: key = "p:" + ph
        row = [cell(r, i) for i in range(len(headers))]
        if key and key in seen:
            k = keep[seen[key]]
            for i, v in enumerate(row):
                if not k["row"][i] and v:
                    k["row"][i] = v; filled += 1
            dups.append({"line": ix + 2, "of": k["line"], "key": key[2:], "row": row})
        else:
            if key: seen[key] = len(keep)
            keep.append({"line": ix + 2, "row": row})
    od = out_dir(args[0])
    write_csv(os.path.join(od, "contacts_clean.csv"), headers, [k["row"] for k in keep])
    write_csv(os.path.join(od, "duplicates_removed.csv"), ["Line", "Duplicate of line", "Matched on"] + headers, [[d["line"], d["of"], d["key"]] + d["row"] for d in dups])
    summary = {"rows_in": len(rows), "kept": len(keep), "duplicates": len(dups), "invalid_emails": invalid, "blank_emails": blank, "cells_filled": filled}
    done(summary, ["%d rows in, %d kept, %d duplicates removed (%d empty cells filled from them)." % (len(rows), len(keep), len(dups), filled),
                   "%d emails look invalid, %d rows have no email." % (invalid, blank), "Written to " + od])
`;
  BODY.bank = String.raw`
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("Usage: python bank_categories.py transactions.csv")
    headers, rows = read_table(args[0])
    C = S["columns"]
    ia, idt, ids = col(headers, C["amount"]), col(headers, C["date"]), col(headers, C["description"])
    rules = []
    for l in S["rules"].splitlines():
        m = re.match(r"^\s*(.+?)\s*=\s*(.+?)\s*$", l)
        if m: rules.append((m.group(1).lower(), m.group(2)))
    cats, months, out, unc = {}, {}, [], []
    skipped = spend = inc = 0
    for ix, r in enumerate(rows):
        a, d, desc = money(cell(r, ia)), date_of(cell(r, idt), S["datefmt"]), cell(r, ids)
        if a is None or d is None:
            skipped += 1; continue
        if S.get("sign") == "positive": a = -a
        low, cat = desc.lower(), ""
        for k, c in rules:
            if k in low:
                cat = c; break
        if not cat: cat = "Income (no rule)" if a > 0 else "Uncategorized"
        mo, c = d.isoformat()[:7], cents(a)
        if c < 0: spend += -c
        else: inc += c
        cats[cat] = cats.get(cat, 0) + c
        months.setdefault(mo, {}); months[mo][cat] = months[mo].get(cat, 0) + c
        o = {"date": d.isoformat(), "description": desc, "amount": c / 100, "category": cat}
        out.append(o)
        if cat == "Uncategorized": unc.append(o)
    lst = sorted(cats.items(), key=lambda kv: (kv[1], kv[0]))
    top = [kv for kv in lst if kv[1] < 0 and kv[0] != "Uncategorized"]
    od = out_dir(args[0])
    write_csv(os.path.join(od, "transactions_categorized.csv"), ["Date", "Description", "Amount", "Category"], [[o["date"], o["description"], "%.2f" % o["amount"], o["category"]] for o in out])
    write_csv(os.path.join(od, "category_totals_by_month.csv"), ["Month", "Category", "Total"], [[mo, c, "%.2f" % (months[mo][c] / 100)] for mo in sorted(months) for c in sorted(months[mo])])
    summary = {"transactions": len(out), "categories": len(lst), "spending": spend / 100, "income": inc / 100, "uncategorized_count": len(unc),
               "uncategorized_total": -sum(cents(o["amount"]) for o in unc) / 100, "top_category": top[0][0] if top else "", "top_total": -top[0][1] / 100 if top else 0,
               "months": len(months), "skipped": skipped}
    lines = ["%d transactions, spending %s, income %s." % (len(out), usd(spend / 100), usd(inc / 100))]
    for k, v in lst: lines.append("  %-24s %12s" % (k[:24], usd(v / 100)))
    lines.append("%d transactions have no rule yet (%s). Written to %s" % (len(unc), usd(summary["uncategorized_total"]), od))
    done(summary, lines)
`;
  BODY.files = String.raw`
TYPES = {"Images": "jpg jpeg png gif heic webp bmp tif tiff svg", "Documents": "pdf doc docx txt rtf odt md pages", "Spreadsheets": "xls xlsx csv ods numbers",
         "Video": "mp4 mov avi mkv webm", "Audio": "mp3 wav m4a aac flac ogg", "Archives": "zip rar 7z tar gz"}

def type_of(ext):
    for k, v in TYPES.items():
        if ext.lower() in v.split(): return k
    return "Other"

def clean_base(b):
    if S.get("lower"): b = b.lower()
    if S.get("tidy"):
        b = re.sub(r"^-|-$", "", re.sub(r"-+", "-", re.sub(r"[\s_]+", "-", re.sub(r"[^A-Za-z0-9._ -]+", "", b))))
    return b or "file"

def plan_for(items):
    used, plan = set(), []
    renamed = moved = same = clash = 0; folders = set()
    for f in sorted(items, key=lambda x: x["name"]):
        name = f["name"]; dot = name.rfind(".")
        base, ext = (name[:dot], name[dot + 1:]) if dot > 0 else (name, "")
        nb = clean_base(base)
        if S.get("date") and not re.match(r"^\d{4}-\d{2}-\d{2}", nb): nb = f["modified"] + "_" + nb
        folder = f["modified"][:7] if S.get("folder") == "month" else (type_of(ext) if S.get("folder") == "type" else "")
        tail = ("." + (ext.lower() if S.get("lower") else ext)) if ext else ""
        pre = folder + "/" if folder else ""
        target, n = pre + nb + tail, 2
        while target.lower() in used:
            target = pre + nb + "-" + str(n) + tail; n += 1
        if n > 2: clash += 1
        used.add(target.lower())
        if folder: folders.add(folder); moved += 1
        if target[len(pre):] != name: renamed += 1
        if target == name: same += 1
        plan.append({"from": name, "to": target, "modified": f["modified"]})
    return plan, {"files": len(plan), "renamed": renamed, "moved": moved, "unchanged": same, "clashes_fixed": clash, "folders": len(folders)}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--undo" in sys.argv:
        log = args[0]
        with open(log, encoding="utf-8", newline="") as fh:
            rows = list(csv.reader(fh))[1:]
        root = os.path.dirname(os.path.abspath(log)); back = 0
        for frm, to in reversed(rows):
            if os.path.exists(os.path.join(root, to)) and not os.path.exists(os.path.join(root, frm)):
                os.rename(os.path.join(root, to), os.path.join(root, frm)); back += 1
        print("Put back %d files." % back); return
    if not args:
        sys.exit("Usage: python rename_sort_files.py FOLDER          (shows the plan, changes nothing)\n       python rename_sort_files.py FOLDER --go     (renames and writes an undo log)")
    folder = os.path.abspath(args[0])
    items = []
    if "--list" in sys.argv:   # test mode: a CSV of name,modified instead of a real folder
        with open(args[0], encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^(.*\S)\s*,\s*(\d{4}-\d{2}-\d{2})\s*$", line.strip())
                if m: items.append({"name": m.group(1).strip(), "modified": m.group(2)})
    else:
        for n in os.listdir(folder):
            p = os.path.join(folder, n)
            if os.path.isfile(p) and not n.startswith(".") and not n.startswith("undo_rename_"):
                items.append({"name": n, "modified": datetime.date.fromtimestamp(os.path.getmtime(p)).isoformat()})
    plan, summary = plan_for(items)
    lines = ["%s  ->  %s" % (p["from"], p["to"]) for p in plan if p["from"] != p["to"]]
    if "--go" in sys.argv and "--list" not in sys.argv:
        log = os.path.join(folder, "undo_rename_%s.csv" % datetime.datetime.now().strftime("%Y%m%d_%H%M%S"))
        with open(log, "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh); w.writerow(["from", "to"])
            for p in plan:
                if p["from"] == p["to"]: continue
                dst = os.path.join(folder, p["to"])
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if os.path.exists(dst): continue
                os.rename(os.path.join(folder, p["from"]), dst); w.writerow([p["from"], p["to"]])
        lines.append("Done. To put everything back: python rename_sort_files.py \"%s\" --undo" % log)
    else:
        lines.append("Nothing was changed. Run again with --go to do it.")
    done(summary, lines)
`;
  BODY.split = String.raw`
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("Usage: python split_csv.py file.csv")
    headers, rows = read_table(args[0])
    C = S["columns"]
    ib, ia = col(headers, C["by"]), col(headers, C.get("amount"), False)
    groups, order = {}, []
    for r in rows:
        v = cell(r, ib) or "(blank)"
        if v not in groups:
            groups[v] = {"rows": [], "c": 0}; order.append(v)
        groups[v]["rows"].append([cell(r, i) for i in range(len(headers))])
        if ia >= 0:
            a = money(cell(r, ia))
            if a is not None: groups[v]["c"] += cents(a)
    order.sort(key=lambda v: (-len(groups[v]["rows"]), v))
    od, names, lst = out_dir(args[0]), set(), []
    for v in order:
        fn = safe_name(v); k = fn; n = 2
        while k.lower() in names:
            k = fn + "-" + str(n); n += 1
        names.add(k.lower())
        write_csv(os.path.join(od, "split", k + ".csv"), headers, groups[v]["rows"])
        lst.append({"value": v, "file": k + ".csv", "rows": len(groups[v]["rows"]), "total": groups[v]["c"] / 100 if ia >= 0 else None})
    summary = {"rows_in": len(rows), "files": len(lst), "largest": lst[0]["value"] if lst else "", "largest_rows": lst[0]["rows"] if lst else 0,
               "total": sum(cents(x["total"]) for x in lst) / 100 if ia >= 0 else 0}
    done(summary, ["%-28s %4d rows  %s" % (x["file"], x["rows"], usd(x["total"]) if x["total"] is not None else "") for x in lst] + ["Written to " + os.path.join(od, "split")])
`;
  var NAMES = { overdue: 'overdue_invoices.py', dedupe: 'dedupe_contacts.py', bank: 'bank_categories.py', files: 'rename_sort_files.py', split: 'split_csv.py' };
  var HOW = {
    overdue: 'python overdue_invoices.py invoices.csv',
    dedupe: 'python dedupe_contacts.py contacts.csv',
    bank: 'python bank_categories.py transactions.csv',
    files: 'python rename_sort_files.py "C:\\Users\\you\\Downloads"   (plan only)  ·  add --go to do it  ·  --undo <log> puts it back',
    split: 'python split_csv.py timesheet.csv'
  };
  function build(id, settings) {
    var js = JSON.stringify(settings, null, 1).replace(/'/g, '\\u0027').replace(/\\/g, '\\\\');
    return '#!/usr/bin/env python3\n# ' + NAMES[id] + ' - made with the automation scripts page. Python 3.8+, standard library only.\n' +
      '# Run:  ' + HOW[id].replace(/\n/g, ' ') + '\n# Your settings from the page are below. Nothing is sent anywhere: the script reads and writes files on your computer only.\n' +
      COMMON + "\nS = json.loads('''" + js + "''')\n" + BODY[id] + '\nif __name__ == "__main__":\n    main()\n';
  }
  var API = { build: build, NAMES: NAMES, HOW: HOW };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ASPY = API;
})(this);
