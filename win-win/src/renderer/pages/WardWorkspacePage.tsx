import { FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useParams } from "react-router-dom";
import { ISSUE_CATEGORIES } from "@shared/constants";
import { localDateString } from "@shared/dates";
import type {
  CoverageKind,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueStatusHistory,
  Person,
  RollEdition,
  TaskItem,
  TaskStatus,
  TeamAssignment,
  Village,
  VoterListItem,
  WardContact,
  WardDetail,
  WardOverview
} from "@shared/types";
import type { AppModel } from "../App";
import { Dialog } from "../Dialog";
import {
  StatusBadge,
  assignmentTone,
  consentTone,
  issueTone,
  taskTone
} from "../StatusBadge";

function roleLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function WardWorkspacePage({ model }: { model: AppModel }): JSX.Element {
  const { id } = useParams();
  const [detail, setDetail] = useState<WardDetail | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [villageId, setVillageId] = useState("");
  const [kind, setKind] = useState<CoverageKind>("complete");

  async function load(): Promise<void> {
    if (!id) return;
    const next = await model.api.wardGet(id);
    setDetail(next);
    if (next.ward.classification === "rural" && next.ward.gramPanchayatId) {
      setVillages(await model.api.villageList({ gramPanchayatId: next.ward.gramPanchayatId }));
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  if (!id) return <p>Missing ward.</p>;
  const wardId = id;
  if (!model.constituencyId) {
    return (
      <div className="card empty">
        <h2>Select a constituency</h2>
        <p>Ward workspace records are scoped to the selected assembly constituency.</p>
      </div>
    );
  }
  if (!detail) return <p>Loading ward…</p>;

  const constituencyName = model.constituencies.find((c) => c.id === model.constituencyId)?.name ?? "Constituency";
  const crumbs = [
    constituencyName,
    detail.breadcrumb.mandal?.name,
    detail.breadcrumb.gramPanchayat?.name,
    detail.breadcrumb.urbanLocalBody?.name,
    `Ward ${detail.ward.wardNumber}`
  ].filter(Boolean);
  const ctx = { wardId, constituencyId: model.constituencyId };

  async function mapVillage(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await model.api.villageWardSet({ villageId, wardId, coverageKind: kind });
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="grid">
      <header className="ward-head">
        <p className="breadcrumb" data-testid="ward-breadcrumb">
          {crumbs.join(" → ")}
        </p>
        <div className="context-strip">
          <h1>
            {detail.ward.name}
            {detail.ward.nameTe ? ` · ${detail.ward.nameTe}` : ""}
          </h1>
          <StatusBadge tone="neutral">{detail.ward.classification}</StatusBadge>
          <span className="counts-inline">No. {detail.ward.wardNumber} · {detail.parent.name}</span>
        </div>
      </header>
      <nav className="tabs" aria-label="Ward workspace">
        <NavLink end className={({ isActive }) => `tab${isActive ? " active" : ""}`} to={`/wards/${id}`} data-testid="tab-overview">
          Overview
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to={`/wards/${id}/contacts`} data-testid="tab-contacts">
          Contacts
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to={`/wards/${id}/team`} data-testid="tab-team">
          Team
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to={`/wards/${id}/issues`} data-testid="tab-issues">
          Issues
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to={`/wards/${id}/tasks`} data-testid="tab-tasks">
          Tasks
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to={`/wards/${id}/voters`} data-testid="tab-voters">
          Voters
        </NavLink>
      </nav>
      <Routes>
        <Route
          path="/"
          element={
            <OverviewTab
              model={model}
              detail={detail}
              ctx={ctx}
              villages={villages}
              villageId={villageId}
              setVillageId={setVillageId}
              kind={kind}
              setKind={setKind}
              mapVillage={mapVillage}
              reload={load}
            />
          }
        />
        <Route path="contacts" element={<ContactsTab model={model} ctx={ctx} />} />
        <Route path="team" element={<TeamTab model={model} ctx={ctx} />} />
        <Route path="issues" element={<IssuesTab model={model} ctx={ctx} />} />
        <Route path="tasks" element={<TasksTab model={model} ctx={ctx} />} />
        <Route path="voters" element={<WardVotersTab model={model} ctx={ctx} />} />
      </Routes>
    </section>
  );
}

function OverviewTab({
  model,
  detail,
  ctx,
  villages,
  villageId,
  setVillageId,
  kind,
  setKind,
  mapVillage,
  reload
}: {
  model: AppModel;
  detail: WardDetail;
  ctx: { wardId: string; constituencyId: string };
  villages: Village[];
  villageId: string;
  setVillageId: (id: string) => void;
  kind: CoverageKind;
  setKind: (kind: CoverageKind) => void;
  mapVillage: (event: FormEvent) => Promise<void>;
  reload: () => Promise<void>;
}): JSX.Element {
  const [overview, setOverview] = useState<WardOverview | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    model.api
      .wardOverview(ctx)
      .then((data) => {
        setOverview(data);
        setBlocked(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("not in the selected constituency")) setBlocked(message);
        else model.setError(message);
      });
  }, [ctx.wardId, ctx.constituencyId]);

  if (blocked) {
    return (
      <article className="card empty">
        <h2>Outside this constituency</h2>
        <p>{blocked}</p>
      </article>
    );
  }

  return (
    <div className="grid">
      <div className="grid stats">
        <article className="card stat" data-testid="overview-contacts">
          <span>Active contacts</span>
          <b>{overview?.activeContacts ?? "—"}</b>
        </article>
        <article className="card stat" data-testid="overview-team">
          <span>Active team</span>
          <b>{overview?.activeTeamAssignments ?? "—"}</b>
        </article>
        <article className="card stat" data-testid="overview-issues">
          <span>Unresolved issues</span>
          <b>{overview?.unresolvedIssues ?? "—"}</b>
        </article>
        <article className="card stat" data-testid="overview-tasks">
          <span>Open tasks</span>
          <b>{overview?.openTasks ?? "—"}</b>
        </article>
        <article className="card stat" data-testid="overview-overdue">
          <span>Overdue tasks</span>
          <b>{overview?.overdueTasks ?? "—"}</b>
        </article>
      </div>
      {!overview || (overview.activeContacts === 0 && overview.unresolvedIssues === 0 && overview.openTasks === 0) ? (
        <p className="empty">No workspace records yet. Add a contact, team assignment, issue or task from the tabs above.</p>
      ) : null}
      <article className="card grid">
        <h2>Recent activity</h2>
        <ul data-testid="overview-activity">
          {overview?.recentActivity.map((item) => (
              <li key={`${item.kind}-${item.recordId}-${item.at}`}>
              {item.action ?? item.kind} · {item.record ?? item.summary} · {item.at.replace("T", " ").slice(0, 16)}
            </li>
          ))}
        </ul>
        {overview && overview.recentActivity.length === 0 ? <p className="empty">No activity recorded for this ward yet.</p> : null}
        <div className="row">
          <NavLink className="btn" to={`/wards/${ctx.wardId}/contacts`}>
            Add contact
          </NavLink>
          <NavLink className="btn secondary" to={`/wards/${ctx.wardId}/team`}>
            Assign team
          </NavLink>
          <NavLink className="btn secondary" to={`/wards/${ctx.wardId}/issues`}>
            Log issue
          </NavLink>
          <NavLink className="btn secondary" to={`/wards/${ctx.wardId}/tasks`}>
            Create task
          </NavLink>
        </div>
      </article>
      {detail.ward.classification === "rural" ? (
        <article className="card grid">
          <h2>Linked villages</h2>
          <ul>
            {detail.villages.map((v) => (
              <li key={v.id}>
                {v.name} — {v.coverageKind}
              </li>
            ))}
          </ul>
          {detail.villages.length === 0 ? <p className="empty">No village mappings yet.</p> : null}
          <form className="grid" onSubmit={mapVillage} data-testid="village-ward-form">
            <label>
              Village
              <select id="village-ward-id" data-testid="village-ward-id" required value={villageId} onChange={(e) => setVillageId(e.target.value)}>
                <option value="">Select…</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Coverage
              <select value={kind} onChange={(e) => setKind(e.target.value as CoverageKind)}>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
              </select>
            </label>
            <button className="btn" id="village-ward-save" data-testid="village-ward-save" type="submit">
              Save mapping
            </button>
          </form>
        </article>
      ) : null}
      <article className="card grid">
        <p>Official code: {detail.ward.officialCode || "not supplied"}</p>
        {detail.referencedByElections.length ? (
          <p>
            Used by elections: {detail.referencedByElections.map((e) => `${e.name} (${e.status})`).join(", ")}. Archive
            rather than delete to preserve history.
          </p>
        ) : null}
        <button
          className="btn danger"
          type="button"
          onClick={async () => {
            if (!window.confirm("Archive this ward? Historical election references will be kept.")) return;
            await model.api.wardArchive(detail.ward.id);
            await reload();
          }}
        >
          Archive ward
        </button>
      </article>
    </div>
  );
}

function ContactsTab({ model, ctx }: { model: AppModel; ctx: { wardId: string; constituencyId: string } }): JSX.Element {
  const [rows, setRows] = useState<WardContact[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [personMode, setPersonMode] = useState<"new" | "existing">("new");
  const [personId, setPersonId] = useState("");
  const [name, setName] = useState("");
  const [nameTe, setNameTe] = useState("");
  const [organization, setOrganization] = useState("");
  const [publicRole, setPublicRole] = useState("");
  const [areaServed, setAreaServed] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consentStatus, setConsentStatus] = useState<Person["consentStatus"]>("unknown");
  const [consentDate, setConsentDate] = useState("");
  const [consentSource, setConsentSource] = useState("");
  const [recordSource, setRecordSource] = useState("");
  const [lastVerifiedAt, setLastVerifiedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function load(): Promise<void> {
    const [list, persons] = await Promise.all([
      model.api.contactList({ ...ctx, query, page: 1, pageSize: 50 }),
      model.api.personList({ includeArchived: false })
    ]);
    setRows(list.items);
    setPeople(persons);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [ctx.wardId, ctx.constituencyId, query]);

  function mark(fn: () => void): void {
    setDirty(true);
    fn();
  }

  function resetForm(): void {
    setEditing(null);
    setPersonMode("new");
    setPersonId("");
    setName("");
    setNameTe("");
    setOrganization("");
    setPublicRole("");
    setAreaServed("");
    setPhone("");
    setEmail("");
    setConsentStatus("unknown");
    setConsentDate("");
    setConsentSource("");
    setRecordSource("");
    setLastVerifiedAt("");
    setNotes("");
    setDirty(false);
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (dirty && busy) return;
    setBusy(true);
    model.setError(null);
    try {
      const person = {
        name,
        nameTe,
        phone,
        email,
        consentStatus,
        consentDate: consentDate || null,
        consentSource
      };
      if (editing) {
        await model.api.contactUpdate({
          id: editing,
          ...ctx,
          person,
          organization,
          publicRole,
          areaServed,
          recordSource,
          lastVerifiedAt: lastVerifiedAt || null,
          coordinationNotes: notes
        });
      } else {
        await model.api.contactCreate({
          ...ctx,
          personId: personMode === "existing" ? personId : undefined,
          person: personMode === "new" ? person : undefined,
          organization,
          publicRole,
          areaServed,
          recordSource,
          lastVerifiedAt: lastVerifiedAt || null,
          coordinationNotes: notes
        });
      }
      resetForm();
      setFormOpen(false);
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div className="toolbar">
        <div className="search">
          <input data-testid="contact-search" placeholder="Search name, organization or role" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button
          className="btn"
          type="button"
          data-testid="contact-add"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          Add contact
        </button>
      </div>
      <article className="card">
        <table className="table" data-testid="contact-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Role</th>
              <th>Consent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.person.name} {row.person.nameTe}
                </td>
                <td>{row.organization}</td>
                <td>{row.publicRole}</td>
                <td>
                  <StatusBadge tone={consentTone(row.person.consentStatus)}>{row.person.consentStatus.replaceAll("_", " ")}</StatusBadge>
                </td>
                <td className="row">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => {
                      if (dirty && !window.confirm("Discard unsaved contact changes?")) return;
                      setEditing(row.id);
                      setPersonMode("existing");
                      setPersonId(row.personId);
                      setName(row.person.name);
                      setNameTe(row.person.nameTe);
                      setOrganization(row.organization);
                      setPublicRole(row.publicRole);
                      setAreaServed(row.areaServed);
                      setPhone(row.person.phone);
                      setEmail(row.person.email);
                      setConsentStatus(row.person.consentStatus);
                      setConsentDate(row.person.consentDate ?? "");
                      setConsentSource(row.person.consentSource);
                      setRecordSource(row.recordSource);
                      setLastVerifiedAt(row.lastVerifiedAt ?? "");
                      setNotes(row.coordinationNotes);
                      setDirty(false);
                      setFormOpen(true);
                    }}
                  >
                    View details
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("Archive this ward association? The person identity is kept.")) return;
                      await model.api.contactArchive({ id: row.id, constituencyId: ctx.constituencyId });
                      await load();
                    }}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No contacts in this ward yet.</p> : null}
      </article>
      <Dialog
        open={formOpen}
        title={editing ? "Edit contact" : "Add contact"}
        onClose={() => {
          if (dirty && !window.confirm("Discard unsaved contact changes?")) return;
          resetForm();
          setFormOpen(false);
        }}
      >
      <form className="grid" onSubmit={onSubmit} data-testid="contact-form">
        <p className="lede">The same person can be linked to several wards. Phone and email are stored only with recorded consent.</p>
        {!editing ? (
          <label>
            Identity
            <select value={personMode} onChange={(e) => mark(() => setPersonMode(e.target.value as "new" | "existing"))}>
              <option value="new">New person</option>
              <option value="existing">Existing person</option>
            </select>
          </label>
        ) : null}
        {personMode === "existing" && !editing ? (
          <label>
            Person
            <select id="contact-person-id" required value={personId} onChange={(e) => mark(() => setPersonId(e.target.value))}>
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              Name
              <input id="contact-name" data-testid="contact-name" required value={name} onChange={(e) => mark(() => setName(e.target.value))} />
            </label>
            <label>
              Telugu name
              <input value={nameTe} onChange={(e) => mark(() => setNameTe(e.target.value))} />
            </label>
            <label>
              Phone
              <input id="contact-phone" data-testid="contact-phone" value={phone} onChange={(e) => mark(() => setPhone(e.target.value))} />
            </label>
            <label>
              Email
              <input value={email} onChange={(e) => mark(() => setEmail(e.target.value))} />
            </label>
            <label>
              Consent
              <select id="contact-consent" data-testid="contact-consent" value={consentStatus} onChange={(e) => mark(() => setConsentStatus(e.target.value as Person["consentStatus"]))}>
                <option value="unknown">Unknown</option>
                <option value="given">Given</option>
                <option value="not_given">Not given</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
            <label>
              Consent date
              <input id="contact-consent-date" data-testid="contact-consent-date" type="date" value={consentDate} onChange={(e) => mark(() => setConsentDate(e.target.value))} />
            </label>
            <label>
              Consent source
              <input id="contact-consent-source" data-testid="contact-consent-source" value={consentSource} onChange={(e) => mark(() => setConsentSource(e.target.value))} />
            </label>
          </>
        )}
        <label>
          Organization
          <input id="contact-org" data-testid="contact-org" value={organization} onChange={(e) => mark(() => setOrganization(e.target.value))} />
        </label>
        <label>
          Public role
          <input id="contact-role" data-testid="contact-role" value={publicRole} onChange={(e) => mark(() => setPublicRole(e.target.value))} />
        </label>
        <label>
          Area served
          <input value={areaServed} onChange={(e) => mark(() => setAreaServed(e.target.value))} />
        </label>
        <label>
          Record source
          <input value={recordSource} onChange={(e) => mark(() => setRecordSource(e.target.value))} />
        </label>
        <label>
          Last verified
          <input type="date" value={lastVerifiedAt} onChange={(e) => mark(() => setLastVerifiedAt(e.target.value))} />
        </label>
        <label>
          Coordination notes
          <textarea value={notes} onChange={(e) => mark(() => setNotes(e.target.value))} />
        </label>
        <div className="row">
          <button className="btn" id="contact-save" data-testid="contact-save" disabled={busy} type="submit">
            {editing ? "Save contact" : "Create contact"}
          </button>
          {editing ? (
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      </Dialog>
    </div>
  );
}

function TeamTab({ model, ctx }: { model: AppModel; ctx: { wardId: string; constituencyId: string } }): JSX.Element {
  const [rows, setRows] = useState<TeamAssignment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState("ward_coordinator");
  const [responsibilities, setResponsibilities] = useState("");
  const [startDate, setStartDate] = useState(localDateString());
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function load(): Promise<void> {
    const [assignments, persons] = await Promise.all([
      model.api.teamList({ ...ctx, includeInactive: true }),
      model.api.personList({ includeArchived: false })
    ]);
    setRows(assignments);
    setPeople(persons);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [ctx.wardId, ctx.constituencyId]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    model.setError(null);
    try {
      await model.api.teamCreate({
        ...ctx,
        personId,
        operationalRole: role,
        responsibilities,
        startDate: startDate || null,
        endDate: endDate || null
      });
      setDirty(false);
      setPersonId("");
      setResponsibilities("");
      setFormOpen(false);
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div className="toolbar">
        <p className="lede">Active and ended assignments stay on this ward. Person identities are not deleted.</p>
        <button className="btn" type="button" data-testid="team-add" onClick={() => setFormOpen(true)}>
          Assign team member
        </button>
      </div>
      <article className="card">
        <table className="table" data-testid="team-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.person?.name}</td>
                <td>{roleLabel(row.operationalRole)}</td>
                <td>
                  {row.startDate ?? "—"} → {row.endDate ?? "open"}
                </td>
                <td>
                  <StatusBadge tone={assignmentTone(row.status)}>{row.status}</StatusBadge>
                </td>
                <td>
                  {row.status === "active" ? (
                    <button
                      className="btn secondary"
                      type="button"
                      data-testid={`team-end-${row.id}`}
                      onClick={async () => {
                        if (!window.confirm("End this assignment? The person record is kept.")) return;
                        await model.api.teamUpdate({
                          id: row.id,
                          personId: row.personId,
                          wardId: row.wardId,
                          constituencyId: row.constituencyId,
                          operationalRole: row.operationalRole,
                          responsibilities: row.responsibilities,
                          startDate: row.startDate,
                          endDate: localDateString(),
                          status: "inactive"
                        });
                        await load();
                      }}
                    >
                      End assignment
                    </button>
                  ) : (
                    "History kept"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No team assignments yet.</p> : null}
      </article>
      <Dialog open={formOpen} title="Assign team member" onClose={() => setFormOpen(false)}>
      <form className="grid" onSubmit={onSubmit} data-testid="team-form">
        <label>
          Person
          <select id="team-person" data-testid="team-person" required value={personId} onChange={(e) => { setDirty(true); setPersonId(e.target.value); }}>
            <option value="">Select…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Operational role
          <select id="team-role" data-testid="team-role" value={role} onChange={(e) => { setDirty(true); setRole(e.target.value); }}>
            <option value="ward_coordinator">Ward coordinator</option>
            <option value="field_volunteer">Field volunteer</option>
            <option value="data_volunteer">Data volunteer</option>
            <option value="issue_follow_up">Issue follow-up</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Responsibilities
          <textarea value={responsibilities} onChange={(e) => { setDirty(true); setResponsibilities(e.target.value); }} />
        </label>
        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => { setDirty(true); setStartDate(e.target.value); }} />
        </label>
        <label>
          End date
          <input type="date" value={endDate} onChange={(e) => { setDirty(true); setEndDate(e.target.value); }} />
        </label>
        <button className="btn" id="team-save" data-testid="team-save" disabled={busy} type="submit">
          Save assignment
        </button>
        {dirty ? <p className="history">Unsaved assignment details.</p> : null}
      </form>
      </Dialog>
    </div>
  );
}

function IssuesTab({ model, ctx }: { model: AppModel; ctx: { wardId: string; constituencyId: string } }): JSX.Element {
  const [rows, setRows] = useState<Issue[]>([]);
  const [team, setTeam] = useState<TeamAssignment[]>([]);
  const [history, setHistory] = useState<IssueStatusHistory[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "">("");
  const [respFilter, setRespFilter] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof ISSUE_CATEGORIES)[number]>("water");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reportedAt, setReportedAt] = useState(localDateString());
  const [responsiblePersonId, setResponsiblePersonId] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<IssueStatus>("open");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [complainantName, setComplainantName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function load(): Promise<void> {
    const [list, assignments] = await Promise.all([
      model.api.issueList({
        ...ctx,
        query,
        category: categoryFilter || undefined,
        status: statusFilter,
        priority: priorityFilter,
        responsiblePersonId: respFilter,
        page: 1,
        pageSize: 50
      }),
      model.api.teamList({ ...ctx, includeInactive: true })
    ]);
    setRows(list.items);
    setTeam(assignments);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [ctx.wardId, ctx.constituencyId, query, categoryFilter, statusFilter, priorityFilter, respFilter]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    model.setError(null);
    try {
      const payload = {
        ...ctx,
        title,
        category,
        location,
        description,
        reportedAt,
        responsiblePersonId: responsiblePersonId || null,
        priority,
        dueDate: dueDate || null,
        status,
        resolutionNotes,
        complainantName
      };
      if (selected) await model.api.issueUpdate({ id: selected, ...payload });
      else await model.api.issueCreate(payload);
      setDirty(false);
      setSelected(null);
      setTitle("");
      setDescription("");
      setLocation("");
      setResolutionNotes("");
      setComplainantName("");
      setStatus("open");
      setFormOpen(false);
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const people = useMemo(() => team.map((a) => a.person).filter(Boolean) as Person[], [team]);

  return (
    <div className="grid">
      <div className="toolbar">
      <div className="row">
        <div className="search">
          <input data-testid="issue-search" placeholder="Search title or reference" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select data-testid="issue-filter-category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {ISSUE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select data-testid="issue-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IssueStatus | "")}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as IssuePriority | "")}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select value={respFilter} onChange={(e) => setRespFilter(e.target.value)}>
          <option value="">All responsible</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
        <button
          className="btn"
          type="button"
          data-testid="issue-add"
          onClick={() => {
            setSelected(null);
            setTitle("");
            setFormOpen(true);
          }}
        >
          Log issue
        </button>
      </div>
      <article className="card">
        <table className="table" data-testid="issue-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.referenceNumber}</td>
                <td>{row.title}</td>
                <td>
                  <StatusBadge tone={issueTone(row.status)}>{row.status.replaceAll("_", " ")}</StatusBadge>
                </td>
                <td>{row.priority}</td>
                <td>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={async () => {
                      if (dirty && !window.confirm("Discard unsaved issue changes?")) return;
                      const detail = await model.api.issueGet({ id: row.id, constituencyId: ctx.constituencyId });
                      setSelected(row.id);
                      setTitle(row.title);
                      setCategory(row.category as (typeof ISSUE_CATEGORIES)[number]);
                      setLocation(row.location);
                      setDescription(row.description);
                      setReportedAt(row.reportedAt);
                      setResponsiblePersonId(row.responsiblePersonId ?? "");
                      setPriority(row.priority);
                      setDueDate(row.dueDate ?? "");
                      setStatus(row.status);
                      setResolutionNotes(row.resolutionNotes);
                      setComplainantName(row.complainantName);
                      setHistory(detail.history);
                      setDirty(false);
                      setFormOpen(true);
                    }}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No issues match these filters.</p> : null}
      </article>
      <Dialog
        open={formOpen}
        title={selected ? "Update issue" : "Log issue"}
        onClose={() => setFormOpen(false)}
      >
      <form className="grid" onSubmit={onSubmit} data-testid="issue-form">
        <label>
          Title
          <input id="issue-title" data-testid="issue-title" required value={title} onChange={(e) => { setDirty(true); setTitle(e.target.value); }} />
        </label>
        <label>
          Category
          <select id="issue-category" data-testid="issue-category" value={category} onChange={(e) => { setDirty(true); setCategory(e.target.value as (typeof ISSUE_CATEGORIES)[number]); }}>
            {ISSUE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Location
          <input value={location} onChange={(e) => { setDirty(true); setLocation(e.target.value); }} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => { setDirty(true); setDescription(e.target.value); }} />
        </label>
        <label>
          Reported
          <input type="date" required value={reportedAt} onChange={(e) => { setDirty(true); setReportedAt(e.target.value); }} />
        </label>
        <label>
          Responsible
          <select id="issue-responsible" data-testid="issue-responsible" value={responsiblePersonId} onChange={(e) => { setDirty(true); setResponsiblePersonId(e.target.value); }}>
            <option value="">None</option>
            {team.map((a) => (
              <option key={a.id} value={a.personId}>
                {a.person?.name} ({a.status})
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => { setDirty(true); setPriority(e.target.value as IssuePriority); }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => { setDirty(true); setDueDate(e.target.value); }} />
        </label>
        <label>
          Status
          <select id="issue-status" data-testid="issue-status" value={status} onChange={(e) => { setDirty(true); setStatus(e.target.value as IssueStatus); }}>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Resolution notes
          <textarea id="issue-resolution" data-testid="issue-resolution" value={resolutionNotes} onChange={(e) => { setDirty(true); setResolutionNotes(e.target.value); }} />
        </label>
        <label>
          Complainant (optional)
          <input value={complainantName} onChange={(e) => { setDirty(true); setComplainantName(e.target.value); }} />
        </label>
        {history.length ? (
          <div>
            <h3>Status history</h3>
            <ul className="history" data-testid="issue-history">
              {history.map((item) => (
                <li key={item.id}>
                  {item.changedAt} · {item.status.replaceAll("_", " ")} {item.note ? `— ${item.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button className="btn" id="issue-save" data-testid="issue-save" disabled={busy} type="submit">
          {selected ? "Save issue" : "Create issue"}
        </button>
      </form>
      </Dialog>
    </div>
  );
}

function TasksTab({ model, ctx }: { model: AppModel; ctx: { wardId: string; constituencyId: string } }): JSX.Element {
  const [rows, setRows] = useState<TaskItem[]>([]);
  const [team, setTeam] = useState<TeamAssignment[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<"" | "overdue" | "upcoming" | "completed" | "open">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [title, setTitle] = useState("");
  const [assignedPersonId, setAssignedPersonId] = useState("");
  const [relatedIssueId, setRelatedIssueId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("open");
  const [completionNotes, setCompletionNotes] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function load(): Promise<void> {
    const [list, assignments, issuePage] = await Promise.all([
      model.api.taskList({ ...ctx, filter, assignedPersonId: assigneeFilter, page: 1, pageSize: 50 }),
      model.api.teamList({ ...ctx, includeInactive: true }),
      model.api.issueList({ ...ctx, page: 1, pageSize: 100 })
    ]);
    setRows(list.items);
    setTeam(assignments);
    setIssues(issuePage.items);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [ctx.wardId, ctx.constituencyId, filter, assigneeFilter]);

  async function save(allowInactive = false): Promise<void> {
    setBusy(true);
    model.setError(null);
    try {
      const payload = {
        ...ctx,
        title,
        assignedPersonId: assignedPersonId || null,
        relatedIssueId: relatedIssueId || null,
        description,
        dueDate: dueDate || null,
        status,
        completionNotes,
        completedAt: status === "done" ? localDateString() : null,
        allowInactiveAssignee: allowInactive
      };
      if (editing) await model.api.taskUpdate({ id: editing, ...payload });
      else await model.api.taskCreate(payload);
      setDirty(false);
      setEditing(null);
      setTitle("");
      setDescription("");
      setDueDate("");
      setAssignedPersonId("");
      setRelatedIssueId("");
      setStatus("open");
      setCompletionNotes("");
      setFormOpen(false);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if ((err as Error & { code?: string }).code === "inactive_assignee" || message.includes("inactive")) {
        if (window.confirm(`${message} Continue anyway?`)) {
          setBusy(false);
          await save(true);
          return;
        }
      }
      model.setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div className="toolbar">
      <div className="row">
        <select data-testid="task-filter" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="">All open and completed</option>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
        <select data-testid="task-filter-assignee" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="">All assignees</option>
          {team.map((a) => (
            <option key={a.id} value={a.personId}>
              {a.person?.name}
            </option>
          ))}
        </select>
      </div>
        <button
          className="btn"
          type="button"
          data-testid="task-add"
          onClick={() => {
            setEditing(null);
            setTitle("");
            setFormOpen(true);
          }}
        >
          Create task
        </button>
      </div>
      <article className="card">
        <table className="table" data-testid="task-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>
                  {row.dueDate ?? "—"} {row.overdue ? <StatusBadge tone="danger">overdue</StatusBadge> : null}
                </td>
                <td>
                  <StatusBadge tone={taskTone(row.status)}>
                    {row.status === "done" ? "completed" : row.status.replaceAll("_", " ")}
                  </StatusBadge>
                </td>
                <td>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => {
                      if (dirty && !window.confirm("Discard unsaved task changes?")) return;
                      setEditing(row.id);
                      setTitle(row.title);
                      setAssignedPersonId(row.assignedPersonId ?? "");
                      setRelatedIssueId(row.relatedIssueId ?? "");
                      setDescription(row.description);
                      setDueDate(row.dueDate ?? "");
                      setStatus(row.status);
                      setCompletionNotes(row.completionNotes);
                      setDirty(false);
                      setFormOpen(true);
                    }}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No tasks match these filters.</p> : null}
      </article>
      <Dialog open={formOpen} title={editing ? "Update task" : "Create task"} onClose={() => setFormOpen(false)}>
      <form
        className="grid"
        data-testid="task-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label>
          Title
          <input id="task-title" data-testid="task-title" required value={title} onChange={(e) => { setDirty(true); setTitle(e.target.value); }} />
        </label>
        <label>
          Assignee
          <select id="task-assignee" data-testid="task-assignee" value={assignedPersonId} onChange={(e) => { setDirty(true); setAssignedPersonId(e.target.value); }}>
            <option value="">Unassigned</option>
            {team.map((a) => (
              <option key={a.id} value={a.personId}>
                {a.person?.name} ({a.status})
              </option>
            ))}
          </select>
        </label>
        <label>
          Related issue
          <select value={relatedIssueId} onChange={(e) => { setDirty(true); setRelatedIssueId(e.target.value); }}>
            <option value="">None</option>
            {issues.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issue.referenceNumber} {issue.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => { setDirty(true); setDescription(e.target.value); }} />
        </label>
        <label>
          Due date
          <input id="task-due" data-testid="task-due" type="date" value={dueDate} onChange={(e) => { setDirty(true); setDueDate(e.target.value); }} />
        </label>
        <label>
          Status
          <select id="task-status" data-testid="task-status" value={status} onChange={(e) => { setDirty(true); setStatus(e.target.value as TaskStatus); }}>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Completion notes
          <textarea id="task-notes" data-testid="task-notes" value={completionNotes} onChange={(e) => { setDirty(true); setCompletionNotes(e.target.value); }} />
        </label>
        <button className="btn" id="task-save" data-testid="task-save" disabled={busy} type="submit">
          {editing ? "Save task" : "Create task"}
        </button>
      </form>
      </Dialog>
    </div>
  );
}

function WardVotersTab({ model, ctx }: { model: AppModel; ctx: { wardId: string; constituencyId: string } }): JSX.Element {
  const [editions, setEditions] = useState<RollEdition[]>([]);
  const [editionId, setEditionId] = useState("");
  const [items, setItems] = useState<VoterListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    model.api
      .editionList({ constituencyId: ctx.constituencyId })
      .then((next) => {
        setEditions(next);
        setEditionId((current) => current || next[0]?.id || "");
      })
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [ctx.constituencyId]);

  useEffect(() => {
    if (!editionId) {
      setItems([]);
      setTotal(0);
      return;
    }
    model.api
      .voterList({
        constituencyId: ctx.constituencyId,
        wardId: ctx.wardId,
        rollEditionId: editionId,
        query,
        page: 1,
        pageSize: 25
      })
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [ctx.constituencyId, ctx.wardId, editionId, query]);

  return (
    <div className="grid">
      <p>Assigned electoral-roll entries for this ward in the selected edition only. Contact identities stay separate.</p>
      <label>
        Roll edition
        <select data-testid="ward-voter-edition" value={editionId} onChange={(e) => setEditionId(e.target.value)}>
          <option value="">Select edition</option>
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {edition.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Search
        <input data-testid="ward-voter-query" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <p data-testid="ward-voter-count">{editionId ? `${total} in this edition` : "Select an edition to see a count."}</p>
      <table className="table" data-testid="ward-voter-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Identifier</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.displayName}</td>
              <td>{item.displayElectoralId}</td>
              <td>{item.displayAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
