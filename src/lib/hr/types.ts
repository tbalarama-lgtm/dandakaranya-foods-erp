export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | "LATE";
export type LeaveType = "SICK" | "CASUAL" | "PAID" | "UNPAID";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type PayrollStatus = "DRAFT" | "PROCESSED" | "PAID";
export type CandidateStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";

export type Employee = {
  id: string;
  employeeNo: string;
  name: string;
  photoUrl?: string | null;
  department: string;
  designation: string;
  phone: string;
  email: string;
  joinedAt: string;
  salary: number;
  employmentType: EmploymentType;
  shift: string;
  status: EmployeeStatus;
  branchId?: string;
  branchName?: string;
  dateOfBirth?: string;
  address?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  aadhaarNumber?: string;
  aadhaarAuthorized?: boolean;
  aadhaarAuthorizedAt?: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  lateMinutes: number;
  overtimeMinutes: number;
  source: "MANUAL" | "BIOMETRIC";
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  createdAt: string;
};

export type LeaveBalance = {
  employeeId: string;
  sick: number;
  casual: number;
  paid: number;
};

export type PayrollRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  grossPay: number;
  allowances: number;
  deductions: number;
  bonus: number;
  pf: number;
  esi: number;
  netPay: number;
  status: PayrollStatus;
};

export type JobOpening = {
  id: string;
  title: string;
  department: string;
  location: string;
  openings: number;
  status: "OPEN" | "CLOSED";
  postedAt: string;
};

export type Candidate = {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone: string;
  stage: CandidateStage;
  resumeUrl?: string;
  resumeFileName?: string;
  interviewAt?: string;
  notes?: string;
};

export type PerformanceReview = {
  id: string;
  employeeId: string;
  period: string;
  rating: number;
  kpiScore: number;
  managerReview: string;
  productivity: number;
};

export type HrNotification = {
  id: string;
  type: "LEAVE" | "PAYROLL" | "ANNIVERSARY" | "DOCUMENT" | "SHIFT";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type ShiftSchedule = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  employees: number;
  branchName: string;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  type: "NATIONAL" | "REGIONAL" | "COMPANY";
  branchName?: string;
};

export type HrDashboardMetrics = {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  newJoinees: number;
  pendingLeaves: number;
  payrollStatus: string;
  upcomingBirthdays: { name: string; date: string }[];
  performanceAlerts: number;
  attendanceTrend: { day: string; present: number; absent: number }[];
  departmentDistribution: { name: string; count: number }[];
  hiringStats: { month: string; hires: number }[];
};
