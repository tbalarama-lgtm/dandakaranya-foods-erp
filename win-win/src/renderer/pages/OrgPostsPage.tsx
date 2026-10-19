import { FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  ORG_APPOINTMENT_STATUSES,
  ORG_GEO_TYPES,
  ORG_IMPORT_KINDS,
  ORG_UNIT_KINDS,
  ORG_UNIT_LEVELS,
  VERIFICATION_STATUSES
} from "@shared/constants";
import type {
  OrgImportKind,
  OrgImportSession,
  OrgOverview,
  OrgPostCapacity,
  OrgReportingNode,
  Organization,
  OrganizationAppointment,
  OrganizationAppointmentHistory,
  OrganizationPost,
  OrganizationUnit,
  OrganizationWing,
  VerificationStatus
} from "@shared/types";
import type { AppModel } from "../App";
import { StatusBadge, type BadgeTone, verificationTone } from "../StatusBadge";

function occupancyTone(kind: OrgPostCapacity["occupancy"]): BadgeTone {
  if (kind === "verified_vacancy") return "warning";
  if (kind === "appointment_recorded") return "success";
  if (kind === "overfilled") return "warning";
  return "info";
}

function occupancyLabel(kind: OrgPostCapacity["occupancy"]): string {
  if (kind === "verified_vacancy") return "Verified vacancy";
  if (kind === "appointment_recorded") return "Appointment recorded";
  if (kind === "overfilled") return "Overfilled (review)";
  return "Status unknown";
}

export function OrgPostsPage({ model }: { model: AppModel }): JSX.Element {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [sourceReference, setSourceReference] = useState("");

  const reload = () => {
    model.api
      .orgList()
      .then((rows) => {
        setOrgs(rows);
        if (!organizationId && rows[0]) setOrganizationId(rows[0].id);
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  useEffect(() => {
    reload();
  }, [model.api]);

  const createOrg = (event: FormEvent) => {
    event.preventDefault();
    model.api
      .orgCreate({ name, sourceReference, verificationStatus: "unverified" })
      .then((org) => {
        setName("");
        setSourceReference("");
        setOrganizationId(org.id);
        reload();
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Voluntary register</p>
          <h1>Organization posts</h1>
          <p className="lede">
            Record supplied organizational structures and office-holder appointments. This register is separate from public
            appointments, elected seats and seat reservations. Names here are not linked to voter, household or benefit records.
          </p>
        </div>
      </header>
      <div className="card grid">
        <form className="row" onSubmit={createOrg}>
          <label>
            Organization
            <select data-testid="org-select" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
              <option value="">Select…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New organization
            <input data-testid="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name as supplied" />
          </label>
          <label>
            Source reference
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          </label>
          <button className="btn" data-testid="org-create" type="submit">
            Add organization
          </button>
        </form>
      </div>
      <nav className="tabs" aria-label="Organization posts">
        <NavLink end className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts" data-testid="org-tab-overview">
          Overview
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/units" data-testid="org-tab-units">
          Units and committees
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/posts" data-testid="org-tab-posts">
          Posts directory
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/structure" data-testid="org-tab-structure">
          Reporting structure
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/holders" data-testid="org-tab-holders">
          Current office holders
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/vacancies" data-testid="org-tab-vacancies">
          Vacancies / unknown
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/expiry" data-testid="org-tab-expiry">
          Tenure expiry
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/history" data-testid="org-tab-history">
          History
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/org-posts/import" data-testid="org-tab-import">
          Import / export
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Overview model={model} organizationId={organizationId} />} />
        <Route path="/units" element={<UnitsScreen model={model} organizationId={organizationId} />} />
        <Route path="/posts" element={<PostsScreen model={model} organizationId={organizationId} />} />
        <Route path="/structure" element={<StructureScreen model={model} organizationId={organizationId} />} />
        <Route path="/holders" element={<HoldersScreen model={model} organizationId={organizationId} />} />
        <Route path="/vacancies" element={<VacanciesScreen model={model} organizationId={organizationId} />} />
        <Route path="/expiry" element={<ExpiryScreen model={model} organizationId={organizationId} />} />
        <Route path="/history" element={<HistoryScreen model={model} organizationId={organizationId} />} />
        <Route path="/import" element={<ImportScreen model={model} organizationId={organizationId} />} />
      </Routes>
    </section>
  );
}

function Overview({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [data, setData] = useState<OrgOverview | null>(null);
  useEffect(() => {
    if (!organizationId) return;
    model.api.orgOverview(organizationId).then(setData).catch(() => undefined);
  }, [model.api, organizationId]);
  if (!organizationId) return <p className="empty">Create or select an organization to begin.</p>;
  if (!data) return <p className="empty">Loading overview…</p>;
  return (
    <div className="grid stats">
      <article className="card stat">
        <span>Units</span>
        <b data-testid="org-stat-units">{data.units}</b>
      </article>
      <article className="card stat">
        <span>Posts</span>
        <b>{data.posts}</b>
      </article>
      <article className="card stat">
        <span>Current office holders</span>
        <b data-testid="org-stat-holders">{data.currentOfficeHolders}</b>
      </article>
      <article className="card stat">
        <span>Verified vacancies</span>
        <b>{data.verifiedVacancies}</b>
      </article>
      <article className="card stat">
        <span>Status unknown</span>
        <b>{data.unknownStatus}</b>
      </article>
      <article className="card stat">
        <span>Expiring in 30 days</span>
        <b>{data.upcomingExpiry30}</b>
      </article>
    </div>
  );
}

function UnitsScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [wings, setWings] = useState<OrganizationWing[]>([]);
  const [wingName, setWingName] = useState("");
  const [name, setName] = useState("");
  const [unitKind, setUnitKind] = useState<(typeof ORG_UNIT_KINDS)[number]>("committee");
  const [level, setLevel] = useState<(typeof ORG_UNIT_LEVELS)[number]>("mandal");
  const [wingId, setWingId] = useState("");
  const [parentUnitId, setParentUnitId] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [geoType, setGeoType] = useState<(typeof ORG_GEO_TYPES)[number]>("mandal");
  const [geoId, setGeoId] = useState("");

  const load = () => {
    if (!organizationId) return;
    model.api.orgUnitList({ organizationId }).then(setUnits).catch(() => undefined);
    model.api.orgWingList(organizationId).then(setWings).catch(() => undefined);
  };
  useEffect(load, [model.api, organizationId]);

  const addWing = (event: FormEvent) => {
    event.preventDefault();
    model.api.orgWingCreate({ organizationId, name: wingName }).then(() => {
      setWingName("");
      load();
    }).catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  const addUnit = (event: FormEvent) => {
    event.preventDefault();
    model.api
      .orgUnitCreate({
        organizationId,
        name,
        unitKind,
        level,
        wingId: wingId || null,
        parentUnitId: parentUnitId || null,
        sourceReference,
        geo: geoId ? [{ geoType, geoId }] : []
      })
      .then(() => {
        setName("");
        setGeoId("");
        load();
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <div className="grid">
      <form className="card row" onSubmit={addWing}>
        <label>
          Configurable wing / committee name
          <input data-testid="org-wing-name" value={wingName} onChange={(e) => setWingName(e.target.value)} />
        </label>
        <button className="btn secondary" type="submit">
          Add wing
        </button>
      </form>
      <form className="card grid" onSubmit={addUnit}>
        <div className="row">
          <label>
            Unit name
            <input data-testid="org-unit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Kind
            <select value={unitKind} onChange={(e) => setUnitKind(e.target.value as typeof unitKind)}>
              {ORG_UNIT_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Organizational level
            <select data-testid="org-unit-level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              {ORG_UNIT_LEVELS.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wing
            <select value={wingId} onChange={(e) => setWingId(e.target.value)}>
              <option value="">None</option>
              {wings.map((wing) => (
                <option key={wing.id} value={wing.id}>
                  {wing.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Parent unit
            <select value={parentUnitId} onChange={(e) => setParentUnitId(e.target.value)}>
              <option value="">None</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label>
            Source reference
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          </label>
          <label>
            Explicit geographic type
            <select value={geoType} onChange={(e) => setGeoType(e.target.value as typeof geoType)}>
              {ORG_GEO_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Geographic record id
            <input data-testid="org-geo-id" value={geoId} onChange={(e) => setGeoId(e.target.value)} placeholder="Optional explicit link" />
          </label>
          <button className="btn" data-testid="org-unit-create" type="submit">
            Add unit
          </button>
        </div>
      </form>
      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Level</th>
              <th>Wing</th>
              <th>Parent</th>
              <th>Geo links</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} data-testid={`org-unit-${unit.id}`}>
                <td>{unit.name}</td>
                <td>{unit.unitKind}</td>
                <td>{unit.level.replaceAll("_", " ")}</td>
                <td>{unit.wingName ?? "—"}</td>
                <td>{unit.parentName ?? "—"}</td>
                <td>{unit.geo.map((link) => `${link.geoType}:${link.geoId}`).join(", ") || "None recorded"}</td>
                <td>
                  <StatusBadge tone={verificationTone(unit.verificationStatus)}>
                    {unit.verificationStatus.replaceAll("_", " ")}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {units.length === 0 ? <p className="empty">No units recorded for this organization.</p> : null}
      </article>
    </div>
  );
}

function PostsScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [posts, setPosts] = useState<OrganizationPost[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState("");
  const [parentPostId, setParentPostId] = useState("");
  const [authorized, setAuthorized] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");

  const load = () => {
    if (!organizationId) return;
    model.api.orgPostList({ organizationId }).then(setPosts).catch(() => undefined);
    model.api.orgUnitList({ organizationId }).then(setUnits).catch(() => undefined);
  };
  useEffect(load, [model.api, organizationId]);

  const add = (event: FormEvent) => {
    event.preventDefault();
    model.api
      .orgPostCreate({
        organizationId,
        unitId,
        title,
        parentPostId: parentPostId || null,
        authorizedPositions: authorized.trim() ? Number(authorized) : null,
        sourceReference,
        verificationStatus
      })
      .then(() => {
        setTitle("");
        setAuthorized("");
        load();
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <div className="grid">
      <form className="card grid" onSubmit={add}>
        <div className="row">
          <label>
            Post title (as supplied)
            <input data-testid="org-post-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Unit
            <select data-testid="org-post-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Select…</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reports to
            <select value={parentPostId} onChange={(e) => setParentPostId(e.target.value)}>
              <option value="">None</option>
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Authorized positions (only if documented)
            <input data-testid="org-post-authorized" value={authorized} onChange={(e) => setAuthorized(e.target.value)} />
          </label>
        </div>
        <div className="row">
          <label>
            Source reference
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          </label>
          <label>
            Verification
            <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}>
              {VERIFICATION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" data-testid="org-post-create" type="submit">
            Add post
          </button>
        </div>
      </form>
      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Unit</th>
              <th>Authorized</th>
              <th>Reports to</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>{post.title}</td>
                <td>{post.unitName}</td>
                <td>{post.authorizedPositions ?? "Not documented"}</td>
                <td>{post.parentTitle ?? "—"}</td>
                <td>{post.verificationStatus.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {posts.length === 0 ? <p className="empty">No posts recorded.</p> : null}
      </article>
    </div>
  );
}

function TreeNodes({ nodes }: { nodes: OrgReportingNode[] }): JSX.Element {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.post.id}>
          {node.post.title} <span className="history">{node.post.unitName}</span>
          {node.children.length ? <TreeNodes nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  );
}

function StructureScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [tree, setTree] = useState<OrgReportingNode[]>([]);
  useEffect(() => {
    if (!organizationId) return;
    model.api.orgPostTree(organizationId).then(setTree).catch(() => undefined);
  }, [model.api, organizationId]);
  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <article className="card" data-testid="org-tree">
      <h2>Reporting structure</h2>
      <p className="history">Circular reporting relationships are rejected when a parent post is saved.</p>
      {tree.length ? <TreeNodes nodes={tree} /> : <p className="empty">No reporting tree yet. Posts without a parent appear at the root.</p>}
    </article>
  );
}

function HoldersScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [posts, setPosts] = useState<OrganizationPost[]>([]);
  const [rows, setRows] = useState<OrganizationAppointment[]>([]);
  const [postId, setPostId] = useState("");
  const [officeHolderName, setOfficeHolderName] = useState("");
  const [membershipReference, setMembershipReference] = useState("");
  const [appointmentReference, setAppointmentReference] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<(typeof ORG_APPOINTMENT_STATUSES)[number]>("active");
  const [consentSource, setConsentSource] = useState("");
  const [allowOverlap, setAllowOverlap] = useState(false);

  const load = () => {
    if (!organizationId) return;
    model.api.orgPostList({ organizationId }).then(setPosts).catch(() => undefined);
    model.api.orgAppointmentList({ organizationId, coveringOnly: true }).then(setRows).catch(() => undefined);
  };
  useEffect(load, [model.api, organizationId]);

  const add = (event: FormEvent) => {
    event.preventDefault();
    model.api
      .orgAppointmentCreate({
        postId,
        officeHolderName,
        membershipReference,
        appointmentReference,
        startDate,
        endDate: endDate || null,
        status,
        consentSource,
        allowOverlap
      })
      .then(() => {
        setOfficeHolderName("");
        load();
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <div className="grid">
      <form className="card grid" onSubmit={add}>
        <div className="row">
          <label>
            Post
            <select data-testid="org-appt-post" value={postId} onChange={(e) => setPostId(e.target.value)}>
              <option value="">Select…</option>
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Office-holder name
            <input data-testid="org-appt-name" value={officeHolderName} onChange={(e) => setOfficeHolderName(e.target.value)} />
          </label>
          <label>
            Membership reference
            <input value={membershipReference} onChange={(e) => setMembershipReference(e.target.value)} />
          </label>
          <label>
            Appointment reference
            <input value={appointmentReference} onChange={(e) => setAppointmentReference(e.target.value)} />
          </label>
        </div>
        <div className="row">
          <label>
            Start date
            <input data-testid="org-appt-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {ORG_APPOINTMENT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Consent / source
            <input value={consentSource} onChange={(e) => setConsentSource(e.target.value)} />
          </label>
        </div>
        <label className="row">
          <input type="checkbox" checked={allowOverlap} onChange={(e) => setAllowOverlap(e.target.checked)} />
          Confirm overlapping covering appointments without merging
        </label>
        <button className="btn" data-testid="org-appt-create" type="submit">
          Record appointment
        </button>
      </form>
      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Office holder</th>
              <th>Post</th>
              <th>Unit</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.officeHolderName}</td>
                <td>{row.postTitle}</td>
                <td>{row.unitName}</td>
                <td>{row.startDate}</td>
                <td>{row.endDate ?? "Open"}</td>
                <td>{row.status}</td>
                <td>{row.verificationStatus.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No covering appointments recorded.</p> : null}
      </article>
    </div>
  );
}

function VacanciesScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [rows, setRows] = useState<OrgPostCapacity[]>([]);
  useEffect(() => {
    if (!organizationId) return;
    model.api.orgVacancies(organizationId).then(setRows).catch(() => undefined);
  }, [model.api, organizationId]);
  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <article className="card">
      <p className="history">
        Vacancy is calculated only when authorized positions and covering appointments are verified. Otherwise the status is
        unknown.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Post</th>
            <th>Unit</th>
            <th>Authorized</th>
            <th>Verified covering</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.postId} data-testid={`org-vacancy-${row.postId}`}>
              <td>{row.title}</td>
              <td>{row.unitName}</td>
              <td>{row.authorizedPositions ?? "Not documented"}</td>
              <td>{row.verifiedCoveringCount}</td>
              <td>
                <StatusBadge tone={occupancyTone(row.occupancy)}>{occupancyLabel(row.occupancy)}</StatusBadge>
              </td>
              <td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function ExpiryScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [windowDays, setWindowDays] = useState<30 | 60 | 90>(30);
  const [rows, setRows] = useState<OrganizationAppointment[]>([]);
  useEffect(() => {
    if (!organizationId) return;
    model.api.orgExpiry({ organizationId, windowDays }).then(setRows).catch(() => undefined);
  }, [model.api, organizationId, windowDays]);
  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <article className="card grid">
      <label>
        Window
        <select data-testid="org-expiry-window" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value) as 30 | 60 | 90)}>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </label>
      <table className="table">
        <thead>
          <tr>
            <th>Office holder</th>
            <th>Post</th>
            <th>End date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.officeHolderName}</td>
              <td>{row.postTitle}</td>
              <td>{row.endDate}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No covering appointments expire in this window.</p> : null}
    </article>
  );
}

function HistoryScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [rows, setRows] = useState<Array<OrganizationAppointmentHistory & { officeHolderName: string; postTitle: string }>>([]);
  useEffect(() => {
    if (!organizationId) return;
    model.api.orgHistory(organizationId).then(setRows).catch(() => undefined);
  }, [model.api, organizationId]);
  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <article className="card">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Office holder</th>
            <th>Post</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.changedAt}</td>
              <td>{row.action}</td>
              <td>{row.officeHolderName}</td>
              <td>{row.postTitle}</td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No appointment history yet.</p> : null}
    </article>
  );
}

function ImportScreen({ model, organizationId }: { model: AppModel; organizationId: string }): JSX.Element {
  const [kind, setKind] = useState<OrgImportKind>("units");
  const [session, setSession] = useState<OrgImportSession | null>(null);
  const [confirmOverlaps, setConfirmOverlaps] = useState(false);
  const [result, setResult] = useState<string>("");
  const fields = useMemo(() => {
    if (kind === "units") return ["name", "unit_kind", "level", "wing_name", "parent_unit_id", "source_reference", "verification_status", "geo_type", "geo_id"];
    if (kind === "posts") return ["unit_id", "title", "wing_name", "authorized_positions", "parent_post_id", "source_reference", "verification_status"];
    return ["post_id", "office_holder_name", "membership_reference", "appointment_reference", "appointment_date", "start_date", "end_date", "status", "consent_source", "verification_status", "verification_notes"];
  }, [kind]);

  const open = () => {
    model.api
      .orgImportOpen({ organizationId, kind })
      .then((opened) => {
        if ("cancelled" in opened && opened.cancelled) return;
        setSession(opened as OrgImportSession);
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  const remap = (field: string, header: string) => {
    if (!session) return;
    const mapping = { ...session.mapping, [field]: header || null };
    model.api.orgImportMap({ sessionId: session.sessionId, mapping }).then(setSession).catch(() => undefined);
  };

  const commit = () => {
    if (!session) return;
    model.api
      .orgImportCommit({ sessionId: session.sessionId, confirmOverlaps })
      .then((committed) => {
        setResult(`Imported ${committed.imported}. Duplicates ${committed.duplicates}. Overlaps ${committed.overlaps}. Unresolved ${committed.unresolved}.`);
        setSession(null);
      })
      .catch((error) => model.setError(error instanceof Error ? error.message : String(error)));
  };

  if (!organizationId) return <p className="empty">Select an organization.</p>;
  return (
    <div className="grid">
      <article className="card grid">
        <p className="history">Separate templates for units, posts and appointments. Duplicates and overlaps are flagged and never merged silently.</p>
        <div className="row">
          <label>
            Template
            <select data-testid="org-import-kind" value={kind} onChange={(e) => setKind(e.target.value as OrgImportKind)}>
              {ORG_IMPORT_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="btn secondary" type="button" onClick={() => model.api.orgImportTemplate({ kind, format: "csv" })}>
            Download CSV template
          </button>
          <button className="btn secondary" type="button" onClick={() => model.api.orgImportTemplate({ kind, format: "xlsx" })}>
            Download XLSX template
          </button>
          <button className="btn" data-testid="org-import-open" type="button" onClick={open}>
            Choose file
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              model.api.orgExport({ organizationId, kind, format: "csv", fields })
            }
          >
            Export selected fields
          </button>
        </div>
      </article>
      {session ? (
        <article className="card grid">
          <h2>Map columns · {session.fileName}</h2>
          {fields.map((field) => (
            <label key={field}>
              {field}
              <select value={session.mapping[field] ?? ""} onChange={(e) => remap(field, e.target.value)}>
                <option value="">Not mapped</option>
                {session.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p>
            Eligible {session.eligibleCount} · Unresolved {session.unresolvedCount} · Duplicates {session.duplicateCount} ·
            Overlaps {session.overlapCount}
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {session.preview.slice(0, 20).map((row) => (
                <tr key={row.index}>
                  <td>{row.index}</td>
                  <td>{row.issues.join("; ") || (row.importable ? "Ready" : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="row">
            <input type="checkbox" checked={confirmOverlaps} onChange={(e) => setConfirmOverlaps(e.target.checked)} />
            Confirm overlapping appointments without merging
          </label>
          <div className="row">
            <button className="btn" data-testid="org-import-commit" type="button" onClick={commit}>
              Confirm import
            </button>
            <button className="btn secondary" type="button" onClick={() => model.api.orgImportCancel(session.sessionId).then(() => setSession(null))}>
              Cancel
            </button>
          </div>
        </article>
      ) : null}
      {result ? <p data-testid="org-import-result">{result}</p> : null}
    </div>
  );
}
