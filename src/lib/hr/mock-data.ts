import type {
  AttendanceRecord,
  Candidate,
  Employee,
  Holiday,
  HrDashboardMetrics,
  HrNotification,
  JobOpening,
  LeaveBalance,
  LeaveRequest,
  PayrollRecord,
  PerformanceReview,
  ShiftSchedule,
} from "./types";

const departments = ["Production", "Sales", "Finance", "HR", "Logistics", "Quality", "R&D"];

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "emp-001",
    employeeNo: "DF-HR-001",
    name: "Balarama T",
    photoUrl: null,
    department: "Operations",
    designation: "Director",
    phone: "+91 9949233777",
    email: "t.balarama@gmail.com",
    joinedAt: "2020-03-15",
    salary: 85000,
    employmentType: "FULL_TIME",
    shift: "General",
    status: "ACTIVE",
    branchName: "Sukma HQ",
    dateOfBirth: "1990-05-12",
  },
  {
    id: "emp-002",
    employeeNo: "DF-PR-012",
    name: "Ramesh Kumar",
    department: "Production",
    designation: "Production Supervisor",
    phone: "+91 9876543210",
    email: "ramesh.k@dandakaranyafoods.com",
    joinedAt: "2021-06-01",
    salary: 42000,
    employmentType: "FULL_TIME",
    shift: "Morning",
    status: "ACTIVE",
    branchName: "Sukma HQ",
    dateOfBirth: "1988-08-22",
  },
  {
    id: "emp-003",
    employeeNo: "DF-SL-008",
    name: "Priya Sharma",
    department: "Sales",
    designation: "Sales Manager",
    phone: "+91 9988776655",
    email: "priya.s@dandakaranyafoods.com",
    joinedAt: "2022-01-10",
    salary: 55000,
    employmentType: "FULL_TIME",
    shift: "General",
    status: "ACTIVE",
    branchName: "Raipur",
    dateOfBirth: "1993-11-03",
  },
  {
    id: "emp-004",
    employeeNo: "DF-FN-004",
    name: "Anil Verma",
    department: "Finance",
    designation: "Accountant",
    phone: "+91 9123456789",
    email: "anil.v@dandakaranyafoods.com",
    joinedAt: "2021-09-20",
    salary: 38000,
    employmentType: "FULL_TIME",
    shift: "General",
    status: "ACTIVE",
    branchName: "Sukma HQ",
    dateOfBirth: "1991-02-14",
  },
  {
    id: "emp-005",
    employeeNo: "DF-HR-002",
    name: "Sunita Devi",
    department: "HR",
    designation: "HR Executive",
    phone: "+91 9001122334",
    email: "hr@dandakaranyafoods.com",
    joinedAt: "2023-04-05",
    salary: 35000,
    employmentType: "FULL_TIME",
    shift: "General",
    status: "ACTIVE",
    branchName: "Sukma HQ",
    dateOfBirth: "1995-07-28",
  },
  {
    id: "emp-006",
    employeeNo: "DF-LG-015",
    name: "Vikram Singh",
    department: "Logistics",
    designation: "Warehouse Lead",
    phone: "+91 9887766554",
    email: "vikram.s@dandakaranyafoods.com",
    joinedAt: "2022-08-15",
    salary: 32000,
    employmentType: "FULL_TIME",
    shift: "Evening",
    status: "ACTIVE",
    branchName: "Sukma HQ",
  },
  {
    id: "emp-007",
    employeeNo: "DF-QA-003",
    name: "Meena Kumari",
    department: "Quality",
    designation: "QC Analyst",
    phone: "+91 9776655443",
    email: "meena.k@dandakaranyafoods.com",
    joinedAt: "2024-01-20",
    salary: 28000,
    employmentType: "FULL_TIME",
    shift: "Morning",
    status: "ACTIVE",
    branchName: "Sukma HQ",
    dateOfBirth: "1997-03-19",
  },
  {
    id: "emp-008",
    employeeNo: "DF-RD-001",
    name: "Arjun Patel",
    department: "R&D",
    designation: "Food Technologist",
    phone: "+91 9665544332",
    email: "arjun.p@dandakaranyafoods.com",
    joinedAt: "2024-06-01",
    salary: 45000,
    employmentType: "FULL_TIME",
    shift: "General",
    status: "ACTIVE",
    branchName: "Sukma HQ",
  },
  {
    id: "emp-009",
    employeeNo: "DF-PR-028",
    name: "Lakshmi Bai",
    department: "Production",
    designation: "Machine Operator",
    phone: "+91 9554433221",
    email: "lakshmi.b@dandakaranyafoods.com",
    joinedAt: "2025-02-10",
    salary: 22000,
    employmentType: "FULL_TIME",
    shift: "Morning",
    status: "ACTIVE",
    branchName: "Sukma HQ",
  },
  {
    id: "emp-010",
    employeeNo: "DF-SL-019",
    name: "Karan Mehta",
    department: "Sales",
    designation: "Sales Executive",
    phone: "+91 9443322110",
    email: "karan.m@dandakaranyafoods.com",
    joinedAt: "2025-04-01",
    salary: 30000,
    employmentType: "FULL_TIME",
    shift: "General",
    status: "ACTIVE",
    branchName: "Mumbai",
  },
  {
    id: "emp-011",
    employeeNo: "DF-PR-031",
    name: "Suresh Yadav",
    department: "Production",
    designation: "Helper",
    phone: "+91 9332211009",
    email: "suresh.y@dandakaranyafoods.com",
    joinedAt: "2023-11-15",
    salary: 18000,
    employmentType: "CONTRACT",
    shift: "Night",
    status: "INACTIVE",
    branchName: "Sukma HQ",
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "lv-1",
    employeeId: "emp-002",
    employeeName: "Ramesh Kumar",
    leaveType: "SICK",
    fromDate: "2026-05-20",
    toDate: "2026-05-21",
    days: 2,
    reason: "Fever",
    status: "PENDING",
    createdAt: "2026-05-18",
  },
  {
    id: "lv-2",
    employeeId: "emp-003",
    employeeName: "Priya Sharma",
    leaveType: "CASUAL",
    fromDate: "2026-05-25",
    toDate: "2026-05-26",
    days: 2,
    reason: "Family function",
    status: "PENDING",
    createdAt: "2026-05-17",
  },
  {
    id: "lv-3",
    employeeId: "emp-006",
    employeeName: "Vikram Singh",
    leaveType: "PAID",
    fromDate: "2026-05-10",
    toDate: "2026-05-12",
    days: 3,
    status: "APPROVED",
    createdAt: "2026-05-01",
  },
];

export const MOCK_LEAVE_BALANCES: LeaveBalance[] = MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE").map(
  (e) => ({
    employeeId: e.id,
    sick: 8,
    casual: 10,
    paid: 15,
  }),
);

export const MOCK_ATTENDANCE: AttendanceRecord[] = MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE")
  .slice(0, 8)
  .map((e, i) => ({
    id: `att-${e.id}`,
    employeeId: e.id,
    date: todayISO(),
    status: i === 2 ? "LATE" : i === 5 ? "ABSENT" : "PRESENT",
    checkIn: i === 5 ? undefined : "09:0" + (i === 2 ? "45" : "02") + ":00",
    checkOut: i === 5 ? undefined : "18:0" + (i % 3) + ":00",
    lateMinutes: i === 2 ? 43 : 0,
    overtimeMinutes: i === 0 ? 45 : 0,
    source: i % 2 === 0 ? "BIOMETRIC" : "MANUAL",
  }));

export const MOCK_PAYROLL: PayrollRecord[] = MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE")
  .slice(0, 6)
  .map((e, i) => {
    const allowances = Math.round(e.salary * 0.12);
    const pf = Math.round(e.salary * 0.12);
    const esi = Math.round(e.salary * 0.0075);
    const deductions = pf + esi + (i === 1 ? 500 : 0);
    const bonus = i === 0 ? 5000 : 0;
    const gross = e.salary + allowances + bonus;
    return {
      id: `pay-${e.id}-2026-4`,
      employeeId: e.id,
      employeeName: e.name,
      month: 4,
      year: 2026,
      grossPay: gross,
      allowances,
      deductions,
      bonus,
      pf,
      esi,
      netPay: gross - deductions,
      status: i < 4 ? "PAID" : "PROCESSED",
    };
  });

export const MOCK_JOBS: JobOpening[] = [
  {
    id: "job-1",
    title: "Production Supervisor",
    department: "Production",
    location: "Sukma, CG",
    openings: 2,
    status: "OPEN",
    postedAt: "2026-04-01",
  },
  {
    id: "job-2",
    title: "Sales Executive — South",
    department: "Sales",
    location: "Hyderabad",
    openings: 3,
    status: "OPEN",
    postedAt: "2026-05-01",
  },
  {
    id: "job-3",
    title: "QC Analyst",
    department: "Quality",
    location: "Sukma, CG",
    openings: 1,
    status: "OPEN",
    postedAt: "2026-05-10",
  },
];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "cand-1",
    jobId: "job-1",
    name: "Deepak Rao",
    email: "deepak.r@email.com",
    phone: "+91 9900112233",
    stage: "INTERVIEW",
    interviewAt: "2026-05-22T10:00:00",
  },
  {
    id: "cand-2",
    jobId: "job-1",
    name: "Sanjay Mishra",
    email: "sanjay.m@email.com",
    phone: "+91 9911223344",
    stage: "SCREENING",
  },
  {
    id: "cand-3",
    jobId: "job-2",
    name: "Neha Gupta",
    email: "neha.g@email.com",
    phone: "+91 9922334455",
    stage: "APPLIED",
  },
  {
    id: "cand-4",
    jobId: "job-2",
    name: "Rahul Joshi",
    email: "rahul.j@email.com",
    phone: "+91 9933445566",
    stage: "OFFER",
  },
  {
    id: "cand-5",
    jobId: "job-3",
    name: "Kavita Nair",
    email: "kavita.n@email.com",
    phone: "+91 9944556677",
    stage: "HIRED",
  },
];

export const MOCK_PERFORMANCE: PerformanceReview[] = MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE")
  .slice(0, 8)
  .map((e, i) => ({
    id: `perf-${e.id}`,
    employeeId: e.id,
    period: "Apr 2026",
    rating: 3.5 + (i % 3) * 0.5,
    kpiScore: 72 + i * 3,
    managerReview: "Consistent performance with room for growth in cross-team collaboration.",
    productivity: 78 + (i % 5) * 4,
  }));

export const MOCK_HR_NOTIFICATIONS: HrNotification[] = [
  {
    id: "hn-1",
    type: "LEAVE",
    title: "Leave approval pending",
    message: "Ramesh Kumar requested 2 days sick leave.",
    createdAt: new Date().toISOString(),
    read: false,
  },
  {
    id: "hn-2",
    type: "PAYROLL",
    title: "May payroll ready",
    message: "Payroll for 11 employees is ready for processing.",
    createdAt: new Date().toISOString(),
    read: false,
  },
  {
    id: "hn-3",
    type: "ANNIVERSARY",
    title: "Work anniversary",
    message: "Priya Sharma completes 4 years on May 19.",
    createdAt: new Date().toISOString(),
    read: true,
  },
];

export const MOCK_SHIFTS: ShiftSchedule[] = [
  { id: "sh-1", name: "Morning", startTime: "06:00", endTime: "14:00", employees: 24, branchName: "Sukma HQ" },
  { id: "sh-2", name: "General", startTime: "09:00", endTime: "18:00", employees: 18, branchName: "Sukma HQ" },
  { id: "sh-3", name: "Evening", startTime: "14:00", endTime: "22:00", employees: 8, branchName: "Sukma HQ" },
  { id: "sh-4", name: "Night", startTime: "22:00", endTime: "06:00", employees: 4, branchName: "Sukma HQ" },
  { id: "sh-5", name: "General", startTime: "09:30", endTime: "18:30", employees: 6, branchName: "Raipur" },
];

export const MOCK_HOLIDAYS: Holiday[] = [
  { id: "h-1", name: "Republic Day", date: "2026-01-26", type: "NATIONAL" },
  { id: "h-2", name: "Holi", date: "2026-03-14", type: "NATIONAL" },
  { id: "h-3", name: "Company Foundation Day", date: "2026-06-15", type: "COMPANY", branchName: "Sukma HQ" },
  { id: "h-4", name: "Independence Day", date: "2026-08-15", type: "NATIONAL" },
  { id: "h-5", name: "Diwali", date: "2026-11-08", type: "NATIONAL" },
  { id: "h-6", name: "Chhattisgarh Rajyotsava", date: "2026-11-01", type: "REGIONAL", branchName: "Sukma HQ" },
];

export function getHrDashboardMetrics(): HrDashboardMetrics {
  const active = MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE");
  const present = MOCK_ATTENDANCE.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const absent = MOCK_ATTENDANCE.filter((a) => a.status === "ABSENT").length;
  const newJoinees = active.filter((e) => e.joinedAt >= "2026-01-01").length;

  const deptMap: Record<string, number> = {};
  active.forEach((e) => {
    deptMap[e.department] = (deptMap[e.department] ?? 0) + 1;
  });

  return {
    totalEmployees: active.length,
    presentToday: present,
    absentToday: absent,
    newJoinees,
    pendingLeaves: MOCK_LEAVE_REQUESTS.filter((l) => l.status === "PENDING").length,
    payrollStatus: "April 2026 — 4 paid, 2 processed",
    upcomingBirthdays: [
      { name: "Meena Kumari", date: "Mar 19" },
      { name: "Balarama T", date: "May 12" },
      { name: "Priya Sharma", date: "Nov 03" },
    ],
    performanceAlerts: MOCK_PERFORMANCE.filter((p) => p.kpiScore < 75).length,
    attendanceTrend: [
      { day: "Mon", present: 9, absent: 1 },
      { day: "Tue", present: 8, absent: 2 },
      { day: "Wed", present: 10, absent: 0 },
      { day: "Thu", present: 9, absent: 1 },
      { day: "Fri", present: 8, absent: 2 },
      { day: "Sat", present: 5, absent: 0 },
    ],
    departmentDistribution: Object.entries(deptMap).map(([name, count]) => ({ name, count })),
    hiringStats: [
      { month: "Jan", hires: 1 },
      { month: "Feb", hires: 1 },
      { month: "Mar", hires: 0 },
      { month: "Apr", hires: 2 },
      { month: "May", hires: 1 },
      { month: "Jun", hires: 1 },
    ],
  };
}

export function getEmployeeById(id: string) {
  return MOCK_EMPLOYEES.find((e) => e.id === id);
}

export const HR_DEPARTMENTS = departments;
