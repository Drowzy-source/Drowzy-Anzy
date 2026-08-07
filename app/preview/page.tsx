"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Building2,
  CalendarClock,
  Wallet,
  UserCheck,
  UserPlus,
  Clock,
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  CircleDashed,
  CheckCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ==========================================
// DUMMY DATA FOR PREVIEW
// ==========================================
const dashboardStats = {
  totalEmployees: 357,
  activeEmployees: 342,
  totalDivisions: 4,
  pendingLeaves: 4,
  totalMonthlyPayroll: 425400,
  newHiresThisMonth: 12,
  todayAttendance: { present: 310, late: 14, halfDay: 5, absent: 13 },
};

const attendanceTrend = [
  { date: "Mon", present: 330, absent: 12, late: 16 },
  { date: "Tue", present: 332, absent: 10, late: 15 },
  { date: "Wed", present: 328, absent: 14, late: 16 },
  { date: "Thu", present: 335, absent: 7, late: 13 },
  { date: "Fri", present: 325, absent: 17, late: 18 },
];

const mockEmployees = [
  { id: 1, badge: "100", name: "Clement Anane", trade: "Labour/Helper", division: "Supply", site: "City Walk", code: 2, status: "Active", salary: "AED 1,200", init: "CA", color: "bg-blue-500" },
  { id: 2, badge: "123", name: "Waqas Kazmi", trade: "Manager QA/QC", division: "Management", site: "PIC", code: 1, status: "Active", salary: "AED 8,500", init: "WK", color: "bg-purple-500" },
  { id: 3, badge: "113", name: "Ibrahim Mumuni", trade: "Mason Tile Asst", division: "Supply", site: "City Walk", code: 2, status: "On Leave", salary: "AED 1,400", init: "IM", color: "bg-amber-500" },
  { id: 4, badge: "116", name: "Bimal Dhimal", trade: "Gypsum Fixer", division: "Sursa", site: "Vida", code: 2, status: "Active", salary: "AED 1,600", init: "BD", color: "bg-emerald-500" },
  { id: 5, badge: "119", name: "Rahul Kumar", trade: "Plumber", division: "Supply - MEP", site: "Venera", code: 2, status: "Active", salary: "AED 1,800", init: "RK", color: "bg-rose-500" },
];

// ==========================================
// REUSABLE UI COMPONENTS
// ==========================================
function StatCard({ label, value, icon: Icon, accent, sublabel }: any) {
  const accentMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function AttendanceBar({ label, value, total, color }: any) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-700">
          {value} <span className="text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ==========================================
// MAIN MEGA PREVIEW COMPONENT
// ==========================================
export default function MegaPreview() {
  const [activeTab, setActiveTab] = useState("employees");
  const [menuOpen, setMenuOpen] = useState<number | null>(null); // For 3-dot menu

  // --- VIEW: DASHBOARD ---
  const renderDashboard = () => (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your organization at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Employees" value={dashboardStats.totalEmployees} icon={Users} accent="indigo" sublabel={`${dashboardStats.activeEmployees} active`} />
        <StatCard label="Divisions" value={dashboardStats.totalDivisions} icon={Building2} accent="purple" />
        <StatCard label="Today Present" value="90%" icon={UserCheck} accent="emerald" sublabel={`${dashboardStats.todayAttendance.present} of ${dashboardStats.activeEmployees}`} />
        <StatCard label="Pending Leaves" value={dashboardStats.pendingLeaves} icon={CalendarClock} accent="amber" />
        <StatCard label="Monthly Payroll" value={`AED ${dashboardStats.totalMonthlyPayroll.toLocaleString()}`} icon={Wallet} accent="blue" />
        <StatCard label="New Hires (MTD)" value={dashboardStats.newHiresThisMonth} icon={UserPlus} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
          <h2 className="font-semibold text-slate-900 mb-4">Attendance Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-6">Today's Attendance</h2>
          <div className="space-y-4">
            <AttendanceBar label="Present" value={dashboardStats.todayAttendance.present} total={dashboardStats.activeEmployees} color="bg-emerald-500" />
            <AttendanceBar label="Late" value={dashboardStats.todayAttendance.late} total={dashboardStats.activeEmployees} color="bg-amber-500" />
            <AttendanceBar label="Half Day" value={dashboardStats.todayAttendance.halfDay} total={dashboardStats.activeEmployees} color="bg-blue-500" />
            <AttendanceBar label="Absent" value={dashboardStats.todayAttendance.absent} total={dashboardStats.activeEmployees} color="bg-rose-500" />
          </div>
        </div>
      </div>
    </div>
  );

  // --- VIEW: EMPLOYEES DIRECTORY ---
  const renderEmployees = () => (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Directory</h1>
          <p className="text-sm text-slate-500">357 employees • 342 active, 15 on leave</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-slate-50/50">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search by Badge, Name, or Trade..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white outline-none">
              <option>All Divisions</option>
              <option>Supply</option>
              <option>Waterproof</option>
            </select>
            <select className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white outline-none">
              <option>All Sites</option>
              <option>City Walk</option>
              <option>Vida</option>
            </select>
            <select className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white outline-none">
              <option>Code 1 & 2</option>
              <option>Code 1 (Staff)</option>
              <option>Code 2 (Worker)</option>
            </select>
          </div>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">Badge & Name</th>
              <th className="px-4 py-3 font-semibold">Trade / Position</th>
              <th className="px-4 py-3 font-semibold">Division</th>
              <th className="px-4 py-3 font-semibold">Site</th>
              <th className="px-4 py-3 font-semibold text-center">Code</th>
              <th className="px-4 py-3 font-semibold">Total Salary</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ${emp.color}`}>
                      {emp.init}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500 font-mono">#{emp.badge}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 font-medium">{emp.trade}</td>
                <td className="px-4 py-3 text-slate-700">{emp.division}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">{emp.site}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${emp.code === 1 ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    Code {emp.code}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-900 font-bold">{emp.salary}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                    {emp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right relative">
                  <button 
                    onClick={() => setMenuOpen(menuOpen === emp.id ? null : emp.id)}
                    className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  
                  {/* 3-Dot Dropdown Menu */}
                  {menuOpen === emp.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-8 top-8 z-20 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm text-left">
                        <button className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-indigo-600 font-bold">
                          👤 Manage Profile
                        </button>
                        <button className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-slate-700">
                          ⏱️ View Timesheets
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- VIEW: ATTENDANCE TRACKER ---
  const renderAttendance = () => (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timekeeper Attendance</h1>
          <p className="text-sm text-slate-500">Log employee attendance, clock-in times, and overtime.</p>
        </div>
        <div className="flex gap-2">
          <input type="date" className="px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg bg-white outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
          <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
            <CheckCheck className="w-4 h-4" /> Save Timesheet
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        <div className="bg-slate-50 p-3 grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">Employee</div>
          <div className="col-span-5 text-center">Attendance Status</div>
          <div className="col-span-4 text-center">Time Tracking (Hours)</div>
        </div>

        {mockEmployees.map((emp, idx) => (
          <div key={emp.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
            
            {/* Employee Info */}
            <div className="col-span-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${emp.color}`}>
                {emp.init}
              </div>
              <div>
                <p className="font-bold text-slate-900">{emp.name} <span className="text-xs font-normal text-slate-400 font-mono ml-1">#{emp.badge}</span></p>
                <p className="text-xs text-slate-500">{emp.trade} • {emp.site}</p>
              </div>
            </div>

            {/* Attendance Buttons */}
            <div className="col-span-5 flex items-center justify-center gap-1.5">
              <button className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors border ${idx === 0 || idx === 1 || idx === 4 ? 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Present
              </button>
              <button className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors border ${idx === 3 ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <Clock className="w-3.5 h-3.5" /> Late
              </button>
              <button className="px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors border bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
                <CircleDashed className="w-3.5 h-3.5" /> Week Off
              </button>
              <button className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors border ${idx === 2 ? 'bg-rose-100 text-rose-800 border-rose-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <XCircle className="w-3.5 h-3.5" /> Absent
              </button>
            </div>

            {/* Time Tracking Inputs */}
            <div className="col-span-4 flex items-center justify-end gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Time In</span>
                <input type="time" defaultValue="07:00" className="px-2 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white outline-none focus:ring-1 focus:ring-indigo-500 w-24" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Time Out</span>
                <input type="time" defaultValue="16:00" className="px-2 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white outline-none focus:ring-1 focus:ring-indigo-500 w-24" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Overtime (h)</span>
                <input type="number" defaultValue={idx === 1 ? 2 : 0} min="0" className="px-2 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold text-indigo-600 bg-white outline-none focus:ring-1 focus:ring-indigo-500 w-16 text-center" />
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-200 min-h-screen flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-xl font-black text-white tracking-tight">Manpower OS</h1>
          <p className="text-xs text-slate-400 mt-1">HR & Timekeeper Portal</p>
        </div>
        <nav className="flex-1 p-3 space-y-2 mt-2">
          {/* HR ADMIN ONLY LINKS */}
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">HR Management</p>
          <button onClick={() => setActiveTab("dashboard")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeTab === "dashboard" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button onClick={() => setActiveTab("employees")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeTab === "employees" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
            <Users size={18} /> Master Directory
          </button>
          
          {/* TIMEKEEPER LINKS */}
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2">Time & Attendance</p>
          <button onClick={() => setActiveTab("attendance")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeTab === "attendance" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
            <ClipboardCheck size={18} /> Daily Tracker
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === "dashboard" && renderDashboard()}
        {activeTab === "employees" && renderEmployees()}
        {activeTab === "attendance" && renderAttendance()}
      </main>
    </div>
  );
}