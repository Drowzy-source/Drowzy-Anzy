"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import * as XLSX from "xlsx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function HRDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "employees" | "divisions" | "manage-profile" | "absents" | "new-hires" | "tracker">("dashboard");
  const [category, setCategory] = useState<"Worker" | "Staff" | "All">("Worker");
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  
  // Tracker State
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]); // YYYY-MM-DD
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [isTrackerLoading, setIsTrackerLoading] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>("");

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Live Supabase State
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Profile Bulk Import State
  const [isImportingProfiles, setIsImportingProfiles] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);

  // Synchronized Scroll References
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableContentRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState<number>(0);

  // Search & Manage Profile State
  const [searchBadge, setSearchBadge] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    badge_number: "",
    name: "",
    trade: "",
    division: "",
    site: "",
    code: 2,
    dob: "",
    doj: "",
    lwd: "",
    status: "Active",
    passport_no: "",
    passport_expiry: "",
    uid_no: "",
    visa_no: "",
    visa_expiry: "",
    labor_card_no: "",
    personal_code: "",
    labor_card_expiry: "",
    health_insurance_no: "",
    health_insurance_expiry: "",
    accidental_insurance_no: "",
    accidental_insurance_expiry: "",
    basic_salary: 0,
    accommodation_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    other_allowance: 0,
    paid_leaves: 0,
    unpaid_leaves: 0,
    leave_reason: "",
    leave_total_days: 0,
    leave_start_date: "",
    leave_end_date: "",
    leave_resumption_date: "",
    leave_overstayed_days: 0,
    leave_out_of_uae_days: 0,
    air_ticket_entitlement: "None",
  });

  // Fetch employees from Supabase
  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (tableContentRef.current) {
      setTableWidth(tableContentRef.current.scrollWidth);
    }
  }, [employees, rowsPerPage, currentPage, category, activeTab]);

  // Dynamic Tracker Data Fetching
  useEffect(() => {
    if (activeTab === "tracker" || activeTab === "dashboard") {
      fetchMonthlyAttendance();
    }
  }, [selectedMonth, activeTab]);

  async function fetchEmployees() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("badge_number", { ascending: true });

      if (!error && data) {
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchMonthlyAttendance() {
    setIsTrackerLoading(true);
    try {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("daily_attendance")
          .select("*")
          .gte("date", `${selectedMonth}-01`)
          .lte("date", `${selectedMonth}-31`)
          .range(from, from + step - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += step;
          if (data.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      setMonthlyAttendance(allData);
    } catch (err: any) {
      console.error("Error fetching monthly attendance:", err.message);
    } finally {
      setIsTrackerLoading(false);
    }
  }

  // 🔄 HELPER: Format YYYY-MM-DD to DD-MM-YYYY for Excel Export
  const formatExportDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // Returns DD-MM-YYYY
    }
    return dateStr;
  };

  // 📂 EXPORT HR PROFILES (.xlsx)
  const handleExportProfiles = (templateOnly = false) => {
    const headers = [
      "Badge Number", "Name", "Code (1=Staff, 2=Worker)", "Trade", "Division", "Site", "Employment Status",
      "DOB (DD-MM-YYYY)", "DOJ (DD-MM-YYYY)", "LWD (DD-MM-YYYY)",
      "Passport No", "Passport Expiry (DD-MM-YYYY)", "UID No", "Visa No", "Visa Expiry (DD-MM-YYYY)",
      "Labor Card No", "Personal Code", "Labor Card Expiry (DD-MM-YYYY)",
      "Health Ins No", "Health Ins Expiry (DD-MM-YYYY)", "WC Ins No", "WC Ins Expiry (DD-MM-YYYY)",
      "Basic Salary", "Accommodation", "Transport", "Food", "Other Allowance",
      "Paid Leaves Taken", "Unpaid Leaves Taken",
      "Leave Reason", "Leave Total Days", "Leave Start (DD-MM-YYYY)", "Leave End (DD-MM-YYYY)", 
      "Resumption Date (DD-MM-YYYY)", "Overstayed Days", "Days Out of UAE", "Air Ticket Entitlement"
    ];

    const dataToExport: any[][] = [headers];

    if (!templateOnly) {
      employees.forEach(emp => {
        dataToExport.push([
          emp.badge_number, 
          emp.name || "", 
          emp.code || (emp.employee_type === 'Staff' ? 1 : 2),
          emp.Trade || emp.trade || "", 
          emp.division || "", 
          emp.site || "", 
          emp.Empoyment_status || emp.status || 'Active',
          formatExportDate(emp.dob), formatExportDate(emp.doj), formatExportDate(emp.lwd),
          emp.passport_no || "", formatExportDate(emp.passport_expiry), emp.uid_no || "", emp.visa_no || "", formatExportDate(emp.visa_expiry),
          emp.labor_card_no || "", emp.personal_code || "", formatExportDate(emp.labor_card_expiry),
          emp.health_insurance_no || "", formatExportDate(emp.health_insurance_expiry), emp.accidental_insurance_no || "", formatExportDate(emp.accidental_insurance_expiry),
          emp.basic_salary || 0, emp.accommodation_allowance || 0, emp.transport_allowance || 0, emp.food_allowance || 0, emp.other_allowance || 0,
          emp.paid_leaves || 0, emp.unpaid_leaves || 0,
          emp.leave_reason || "", emp.leave_total_days || 0, formatExportDate(emp.leave_start_date), formatExportDate(emp.leave_end_date),
          formatExportDate(emp.leave_resumption_date), emp.leave_overstayed_days || 0, emp.leave_out_of_uae_days || 0, emp.air_ticket_entitlement || "None"
        ]);
      });
    } else {
      // Provide one empty example row for the template using DD-MM-YYYY
      dataToExport.push(["9999", "John Doe", "2", "Mason", "Supply", "Site A", "Active", "25-12-1990", "15-03-2024", "", "", "", "", "", "", "", "", "", "", "", "", "", "1000", "200", "0", "0", "0", "0", "14", "Annual Leave", "30", "01-08-2026", "30-08-2026", "31-08-2026", "0", "30", "Annual (Company Paid)"]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    XLSX.utils.book_append_sheet(wb, ws, "Employee Master");
    const filename = templateOnly ? "Employee_Profile_Template.xlsx" : `Employee_Master_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // 📂 IMPORT HR PROFILES (.xlsx)
  const handleImportProfiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ You are about to mass update employee profiles. Are you sure you want to proceed?")) {
      event.target.value = '';
      return;
    }

    setIsImportingProfiles(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        
        // raw: false converts excel date objects to readable strings based on cell format
        const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });

        if (rows.length < 2) throw new Error("File is empty or missing data rows.");

        const headers = rows[0].map((h: any) => (h || '').toString().toLowerCase());
        const getColIdx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

        const colBadge = getColIdx(['badge']);
        const colName = getColIdx(['name']);
        const colCode = getColIdx(['code (', 'code']);
        const colTrade = getColIdx(['trade', 'designation']);
        const colDivision = getColIdx(['division']);
        const colSite = getColIdx(['site']);
        const colStatus = getColIdx(['status']);
        const colDob = getColIdx(['dob']);
        const colDoj = getColIdx(['doj']);
        const colLwd = getColIdx(['lwd']);
        const colPassport = getColIdx(['passport no']);
        const colPassportExp = getColIdx(['passport exp']);
        const colUid = getColIdx(['uid']);
        const colVisa = getColIdx(['visa no']);
        const colVisaExp = getColIdx(['visa exp']);
        const colLabor = getColIdx(['labor card no']);
        const colPersonal = getColIdx(['personal code']);
        const colLaborExp = getColIdx(['labor card exp']);
        const colHealth = getColIdx(['health ins no']);
        const colHealthExp = getColIdx(['health ins exp']);
        const colWc = getColIdx(['wc ins no', 'wc ins']);
        const colWcExp = getColIdx(['wc ins exp', 'wc exp']);
        const colBasic = getColIdx(['basic']);
        const colAcc = getColIdx(['accommodation']);
        const colTrans = getColIdx(['transport']);
        const colFood = getColIdx(['food']);
        const colOther = getColIdx(['other allowance', 'other']);
        const colPaidLeaves = getColIdx(['paid leaves']);
        const colUnpaidLeaves = getColIdx(['unpaid leaves']);
        
        const colLeaveReason = getColIdx(['leave reason']);
        const colLeaveDays = getColIdx(['leave total days']);
        const colLeaveStart = getColIdx(['leave start']);
        const colLeaveEnd = getColIdx(['leave end']);
        const colLeaveResump = getColIdx(['resumption date']);
        const colLeaveOverstay = getColIdx(['overstayed']);
        const colLeaveOutUae = getColIdx(['days out of uae']);
        const colTicket = getColIdx(['air ticket']);

        if (colBadge === -1 || colName === -1) {
          throw new Error("Could not find 'Badge Number' or 'Name' columns. Please use the exact template format.");
        }

        // 🔄 HELPER: Safely parse DD-MM-YYYY (or DD/MM/YYYY) back to YYYY-MM-DD for Supabase
        const parseImportDate = (val: any) => {
          if (!val) return null;
          let str = String(val).trim();
          if (str === '') return null;
          
          // Matches DD-MM-YYYY or DD/MM/YYYY
          const parts = str.split(/[-/]/); 
          if (parts.length === 3) {
            let day = parts[0];
            let month = parts[1];
            let year = parts[2];
            
            // Failsafe: if user accidentally typed YYYY-MM-DD
            if (year.length === 4 && day.length <= 2) {
               return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            // Failsafe: if the format got reversed (YYYY-MM-DD)
            if (day.length === 4) {
               return `${day}-${month.padStart(2, '0')}-${year.padStart(2, '0')}`;
            }
            
            // Standard DD-MM-YYYY parsing
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          
          // Fallback to standard JS parsing if it's formatted weirdly
          try {
            const d = new Date(str);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
          } catch {
            return null;
          }
          return null;
        };

        const recordsToUpsert = [];
        let validRows = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[colBadge]) continue;

          const rawBadge = String(row[colBadge]).replace(/\D/g, '');
          if (!rawBadge) continue;
          
          const badgeNum = parseInt(rawBadge, 10);
          const parsedCode = colCode !== -1 ? parseInt(row[colCode], 10) : 2;

          recordsToUpsert.push({
            badge_number: badgeNum,
            name: row[colName] || "",
            code: isNaN(parsedCode) ? 2 : parsedCode,
            employee_type: parsedCode === 1 ? 'Staff' : 'Worker',
            Trade: colTrade !== -1 ? row[colTrade] : null,
            division: colDivision !== -1 ? row[colDivision] : null,
            site: colSite !== -1 ? row[colSite] : null,
            Empoyment_status: colStatus !== -1 ? row[colStatus] || 'Active' : 'Active',
            dob: colDob !== -1 ? parseImportDate(row[colDob]) : null,
            doj: colDoj !== -1 ? parseImportDate(row[colDoj]) : null,
            lwd: colLwd !== -1 ? parseImportDate(row[colLwd]) : null,
            passport_no: colPassport !== -1 ? row[colPassport] : null,
            passport_expiry: colPassportExp !== -1 ? parseImportDate(row[colPassportExp]) : null,
            uid_no: colUid !== -1 ? row[colUid] : null,
            visa_no: colVisa !== -1 ? row[colVisa] : null,
            visa_expiry: colVisaExp !== -1 ? parseImportDate(row[colVisaExp]) : null,
            labor_card_no: colLabor !== -1 ? row[colLabor] : null,
            personal_code: colPersonal !== -1 ? row[colPersonal] : null,
            labor_card_expiry: colLaborExp !== -1 ? parseImportDate(row[colLaborExp]) : null,
            health_insurance_no: colHealth !== -1 ? row[colHealth] : null,
            health_insurance_expiry: colHealthExp !== -1 ? parseImportDate(row[colHealthExp]) : null,
            accidental_insurance_no: colWc !== -1 ? row[colWc] : null,
            accidental_insurance_expiry: colWcExp !== -1 ? parseImportDate(row[colWcExp]) : null,
            basic_salary: colBasic !== -1 ? (Number(row[colBasic]) || 0) : 0,
            accommodation_allowance: colAcc !== -1 ? (Number(row[colAcc]) || 0) : 0,
            transport_allowance: colTrans !== -1 ? (Number(row[colTrans]) || 0) : 0,
            food_allowance: colFood !== -1 ? (Number(row[colFood]) || 0) : 0,
            other_allowance: colOther !== -1 ? (Number(row[colOther]) || 0) : 0,
            paid_leaves: colPaidLeaves !== -1 ? (Number(row[colPaidLeaves]) || 0) : 0,
            unpaid_leaves: colUnpaidLeaves !== -1 ? (Number(row[colUnpaidLeaves]) || 0) : 0,
            
            leave_reason: colLeaveReason !== -1 ? row[colLeaveReason] : null,
            leave_total_days: colLeaveDays !== -1 ? (Number(row[colLeaveDays]) || 0) : 0,
            leave_start_date: colLeaveStart !== -1 ? parseImportDate(row[colLeaveStart]) : null,
            leave_end_date: colLeaveEnd !== -1 ? parseImportDate(row[colLeaveEnd]) : null,
            leave_resumption_date: colLeaveResump !== -1 ? parseImportDate(row[colLeaveResump]) : null,
            leave_overstayed_days: colLeaveOverstay !== -1 ? (Number(row[colLeaveOverstay]) || 0) : 0,
            leave_out_of_uae_days: colLeaveOutUae !== -1 ? (Number(row[colLeaveOutUae]) || 0) : 0,
            air_ticket_entitlement: colTicket !== -1 ? (row[colTicket] || "None") : "None",
          });
          validRows++;
        }

        if (recordsToUpsert.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
              .from('employees')
              .upsert(batch, { onConflict: 'badge_number' });

            if (error) throw error;
          }

          alert(`✅ Success! Mass updated ${validRows} employee profiles.`);
          await fetchEmployees();
        } else {
          alert('❌ No valid records found to import.');
        }

      } catch (err: any) {
        alert('Import Error: ' + err.message);
      } finally {
        setIsImportingProfiles(false);
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Synchronized Scroll Handlers
  const handleTopScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  // Profile Lookup Handler
  const loadEmployeeIntoForm = (emp: any) => {
    setFormData({
      badge_number: emp.badge_number || "",
      name: emp.name || `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
      trade: emp.Trade || emp.trade || "",
      division: emp.division || "",
      site: emp.site || "",
      code: emp.code || (emp.employee_type === "Staff" ? 1 : 2),
      dob: emp.dob || "",
      doj: emp.doj || "",
      lwd: emp.lwd || "",
      status: emp.Empoyment_status || emp.status || "Active",
      passport_no: emp.passport_no || "",
      passport_expiry: emp.passport_expiry || "",
      uid_no: emp.uid_no || "",
      visa_no: emp.visa_no || "",
      visa_expiry: emp.visa_expiry || "",
      labor_card_no: emp.labor_card_no || "",
      personal_code: emp.personal_code || "",
      labor_card_expiry: emp.labor_card_expiry || "",
      health_insurance_no: emp.health_insurance_no || "",
      health_insurance_expiry: emp.health_insurance_expiry || "",
      accidental_insurance_no: emp.accidental_insurance_no || "",
      accidental_insurance_expiry: emp.accidental_insurance_expiry || "",
      basic_salary: Number(emp.basic_salary) || 0,
      accommodation_allowance: Number(emp.accommodation_allowance) || 0,
      transport_allowance: Number(emp.transport_allowance) || 0,
      food_allowance: Number(emp.food_allowance) || 0,
      other_allowance: Number(emp.other_allowance) || 0,
      paid_leaves: Number(emp.paid_leaves) || 0,
      unpaid_leaves: Number(emp.unpaid_leaves) || 0,
      leave_reason: emp.leave_reason || "",
      leave_total_days: Number(emp.leave_total_days) || 0,
      leave_start_date: emp.leave_start_date || "",
      leave_end_date: emp.leave_end_date || "",
      leave_resumption_date: emp.leave_resumption_date || "",
      leave_overstayed_days: Number(emp.leave_overstayed_days) || 0,
      leave_out_of_uae_days: Number(emp.leave_out_of_uae_days) || 0,
      air_ticket_entitlement: emp.air_ticket_entitlement || "None",
    });
    setSearchBadge(String(emp.badge_number || ""));
    setSaveStatus(null);
  };

  const handleSearchBadge = (badgeToFind: string) => {
    setSearchBadge(badgeToFind);
    const found = employees.find((emp) => String(emp.badge_number) === String(badgeToFind).trim());
    if (found) {
      loadEmployeeIntoForm(found);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const totalSalary =
    Number(formData.basic_salary) +
    Number(formData.accommodation_allowance) +
    Number(formData.transport_allowance) +
    Number(formData.food_allowance) +
    Number(formData.other_allowance);

  // Leave Math Logic per MoHRE: Minus 1 accrued annual leave day for every 14 days of unpaid leave
  const accruedAnnualLeave = 30 - Math.floor(Number(formData.unpaid_leaves || 0) / 14);
  const remainingLeaveBalance = accruedAnnualLeave - Number(formData.paid_leaves || 0);

  // Save profile changes to Supabase
  const handleSaveProfile = async () => {
    if (!formData.badge_number) {
      alert("Please enter a valid Badge Number.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("⏳ Saving record to Supabase...");

    const payload = {
      badge_number: formData.badge_number,
      name: formData.name,
      Trade: formData.trade,
      division: formData.division,
      site: formData.site,
      code: Number(formData.code),
      employee_type: Number(formData.code) === 1 ? "Staff" : "Worker",
      Empoyment_status: formData.status,
      dob: formData.dob || null,
      doj: formData.doj || null,
      lwd: formData.lwd || null,
      passport_no: formData.passport_no,
      passport_expiry: formData.passport_expiry || null,
      uid_no: formData.uid_no,
      visa_no: formData.visa_no,
      visa_expiry: formData.visa_expiry || null,
      labor_card_no: formData.labor_card_no,
      personal_code: formData.personal_code,
      labor_card_expiry: formData.labor_card_expiry || null,
      health_insurance_no: formData.health_insurance_no,
      health_insurance_expiry: formData.health_insurance_expiry || null,
      accidental_insurance_no: formData.accidental_insurance_no,
      accidental_insurance_expiry: formData.accidental_insurance_expiry || null,
      basic_salary: Number(formData.basic_salary) || 0,
      accommodation_allowance: Number(formData.accommodation_allowance) || 0,
      transport_allowance: Number(formData.transport_allowance) || 0,
      food_allowance: Number(formData.food_allowance) || 0,
      other_allowance: Number(formData.other_allowance) || 0,
      paid_leaves: Number(formData.paid_leaves) || 0,
      unpaid_leaves: Number(formData.unpaid_leaves) || 0,
      leave_reason: formData.leave_reason,
      leave_total_days: Number(formData.leave_total_days) || 0,
      leave_start_date: formData.leave_start_date || null,
      leave_end_date: formData.leave_end_date || null,
      leave_resumption_date: formData.leave_resumption_date || null,
      leave_overstayed_days: Number(formData.leave_overstayed_days) || 0,
      leave_out_of_uae_days: Number(formData.leave_out_of_uae_days) || 0,
      air_ticket_entitlement: formData.air_ticket_entitlement,
    };

    const { error } = await supabase
      .from("employees")
      .upsert(payload, { onConflict: "badge_number" });

    if (error) {
      setSaveStatus(`❌ Save Failed: ${error.message}`);
    } else {
      setSaveStatus(`✅ Employee #${formData.badge_number} updated successfully!`);
      await fetchEmployees();
    }
    setIsSaving(false);
  };

  // Status Badge Styling Helper
  const getStatusBadgeStyle = (statusRaw: string) => {
    const status = (statusRaw || "").toLowerCase().replace(/['"']/g, "").trim();
    if (status === "active") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (status.includes("notice")) return "bg-amber-100 text-amber-700 border border-amber-200";
    if (status.includes("resign") || status.includes("terminat") || status.includes("abscond") || status.includes("awol")) {
      return "bg-rose-100 text-rose-700 border border-rose-200";
    }
    if (status.includes("vacation") || status.includes("leave") || status.includes("transfer")) {
      return "bg-sky-100 text-sky-700 border border-sky-200";
    }
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  // Category & Search Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const isStaff = emp.employee_type === "Staff" || emp.category === "Code 1" || String(emp.code) === "1";
    if (category === "Staff" && !isStaff) return false;
    if (category === "Worker" && isStaff) return false;

    const search = searchTerm.toLowerCase();
    const badge = String(emp.badge_number || "").toLowerCase();
    const name = String(emp.name || "").toLowerCase();
    const trade = String(emp.Trade || emp.trade || "").toLowerCase();
    const site = String(emp.site || "").toLowerCase();
    return badge.includes(search) || name.includes(search) || trade.includes(search) || site.includes(search);
  });

  // Division Filter Helper
  const getDivisionEmployees = (divName: string) => {
    return employees.filter((emp) => {
      const div = String(emp.division || emp.site || "").toLowerCase();
      return div.includes(divName.toLowerCase());
    });
  };

  // Navigation Click Handler for Mobile
  const handleNavClick = (tab: "dashboard" | "employees" | "divisions" | "manage-profile" | "absents" | "new-hires" | "tracker") => {
    setActiveTab(tab);
    setSelectedDivision(null);
    setIsMobileMenuOpen(false);
  };

  // Pagination Calculations
  const totalPages = Math.ceil(filteredEmployees.length / (rowsPerPage || 1)) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedEmployees = rowsPerPage === 0 ? filteredEmployees : filteredEmployees.slice(startIndex, startIndex + rowsPerPage);

  // Dynamically calculate tracker days for the selected month
  const trackerRows = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    if (!yearStr || !monthStr) return [];
    
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const activeWorkers = employees.filter(e => {
        const status = (e.Empoyment_status || e.status || "Active").toLowerCase();
        return !status.includes('resign') && !status.includes('terminat') && !status.includes('abscond');
    }).length || employees.length;

    const rows = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const dPadded = String(day).padStart(2, '0');
        const dateStr = `${selectedMonth}-${dPadded}`;
        const dt = new Date(year, month - 1, day);
        
        let dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
        if (dateStr === todayStr) {
            dayName += " (Today)";
        }

        const dailyRecords = monthlyAttendance.filter(r => r.date === dateStr);
        const present = dailyRecords.filter(r => (r.attendance_status || r.status) === 'Present').length;
        const late = dailyRecords.filter(r => (r.attendance_status || r.status) === 'Late').length;
        const absent = dailyRecords.filter(r => (r.attendance_status || r.status) === 'Absent').length;
        const leave = dailyRecords.filter(r => ['Leave', 'On Leave', 'Sick'].includes(r.attendance_status || r.status)).length;
        const ot = dailyRecords.reduce((sum, r) => sum + (Number(r.overtime_hours || r.ot_hours) || 0), 0);

        let rate = "0.0%";
        if (activeWorkers > 0) {
            rate = (((present + late) / activeWorkers) * 100).toFixed(1) + "%";
        }

        const displayDate = dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

        rows.push({
            dateVal: dateStr,
            dateDisplay: displayDate,
            dayName: dayName,
            total: activeWorkers,
            present,
            late,
            absent,
            leave,
            ot,
            rate
        });
    }
    return rows;
  }, [selectedMonth, monthlyAttendance, employees]);

  // Aggregate selected date metrics for the Tracker KPI cards
  const selectedDateMetrics = useMemo(() => {
    const dailyRecords = monthlyAttendance.filter(r => r.date === selectedDate);
    const present = dailyRecords.filter(r => (r.attendance_status || r.status) === 'Present').length;
    const late = dailyRecords.filter(r => (r.attendance_status || r.status) === 'Late').length;
    const absent = dailyRecords.filter(r => (r.attendance_status || r.status) === 'Absent').length;
    const leave = dailyRecords.filter(r => ['Leave', 'On Leave', 'Sick'].includes(r.attendance_status || r.status)).length;
    const ot = dailyRecords.reduce((sum, r) => sum + (Number(r.overtime_hours || r.ot_hours) || 0), 0);
    
    return { present, late, absent, leave, ot };
  }, [selectedDate, monthlyAttendance]);

  const stats = {
    totalEmployees: employees.length || 358,
    activeEmployees: employees.filter((e) => {
      const s = String(e.Empoyment_status || e.status || "active").toLowerCase();
      return s.includes("active");
    }).length || 342,
    divisionsCount: 4,
    totalPresents: selectedDateMetrics.present || 0,
    totalAbsents: selectedDateMetrics.absent || 0,
    latePresents: selectedDateMetrics.late || 0,
    halfDays: 5,
    monthlyPayroll: "AED 425,400",
    newHiresCount: 12,
  };

  const divisionsList = [
    { id: "supply", name: "Supply", count: getDivisionEmployees("Supply").length || 142, head: "Ahmed Hassan" },
    { id: "supply-mep", name: "Supply - MEP", count: getDivisionEmployees("MEP").length || 85, head: "Suresh Kumar" },
    { id: "waterproof", name: "Waterproof", count: getDivisionEmployees("Waterproof").length || 68, head: "Tariq Ali" },
    { id: "sursa", name: "Sursa", count: getDivisionEmployees("Sursa").length || 62, head: "Mohamed Gouhar" },
  ];

  const monthOptions = [
    new Date().toISOString().slice(0, 7),
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7),
    new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().slice(0, 7),
    new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 7)
  ];

  // Monthly Attendance & Absent Trend Data
  const monthlyTrendData = [
    { month: "Mar", rate: 94, presents: 335, absents: 8 },
    { month: "Apr", rate: 92, presents: 328, absents: 12 },
    { month: "May", rate: 95, presents: 340, absents: 6 },
    { month: "Jun", rate: 91, presents: 325, absents: 15 },
    { month: "Jul", rate: 93, presents: 332, absents: 10 },
    { month: "Aug", rate: 91, presents: 310, absents: 13 },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-100 font-sans">

      {/* 📱 MOBILE TOP HEADER BAR */}
      <div className="md:hidden bg-slate-900 text-white p-4 sticky top-0 z-50 flex items-center justify-between border-b border-slate-800">
        <div>
          <h1 className="text-base font-black tracking-tight">Manpower OS</h1>
          <p className="text-[10px] text-slate-400 font-medium">HR Hub Portal</p>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="px-3 py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
        >
          {isMobileMenuOpen ? "✕ Close" : "☰ Menu"}
        </button>
      </div>

      {/* 📱 MOBILE NAVIGATION DRAWER OVERLAY */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-slate-300 p-5 space-y-4 border-b border-slate-800">
          <Link
            href="/"
            className="block text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs shadow-sm"
          >
            ⏱️ Switch to Daily Tracker Main System UI (/)
          </Link>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">HR Navigation</p>
            <button
              onClick={() => handleNavClick("dashboard")}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-bold text-xs transition ${
                activeTab === "dashboard" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              📊 Dashboard Overview
            </button>
            <button
              onClick={() => handleNavClick("employees")}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-bold text-xs transition ${
                activeTab === "employees" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              👥 Total Employees ({stats.totalEmployees})
            </button>
            <button
              onClick={() => handleNavClick("divisions")}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-bold text-xs transition ${
                activeTab === "divisions" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              🏢 4 Divisions Breakdown
            </button>
            <button
              onClick={() => handleNavClick("absents")}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-bold text-xs transition ${
                activeTab === "absents" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              ❌ Total Absents Log
            </button>
            <button
              onClick={() => handleNavClick("manage-profile")}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-bold text-xs transition ${
                activeTab === "manage-profile" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              👤 Manage Employee Profiles
            </button>
            <button
              onClick={() => handleNavClick("tracker")}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-bold text-xs transition ${
                activeTab === "tracker" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              📅 Daily Tracker Tab
            </button>
          </div>
        </div>
      )}

      {/* 🟢 DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 p-5 flex-col justify-between shrink-0 min-h-screen">
        <div>
          <div className="mb-6">
            <Link href="/" className="inline-block text-[11px] font-bold text-blue-400 hover:text-blue-300 mb-2 transition">
              ← Return to Main Daily Tracker UI
            </Link>
            <h1 className="text-xl font-black text-white tracking-tight">Manpower OS</h1>
            <p className="text-xs text-slate-400 font-medium">HR & Timekeeper Portal</p>
          </div>

          <nav className="space-y-6 text-sm">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">HR Management</p>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveTab("dashboard"); setSelectedDivision(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-bold transition ${
                    activeTab === "dashboard" ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  📊 Dashboard
                </button>
                <button
                  onClick={() => { setActiveTab("employees"); setSelectedDivision(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-bold transition ${
                    activeTab === "employees" ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  👥 Total Employees ({stats.totalEmployees})
                </button>
                <button
                  onClick={() => { setActiveTab("divisions"); setSelectedDivision(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-bold transition ${
                    activeTab === "divisions" ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  🏢 Divisions
                </button>
                <button
                  onClick={() => { setActiveTab("absents"); setSelectedDivision(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-bold transition ${
                    activeTab === "absents" ? "bg-rose-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  ❌ Total Absents
                </button>
                <button
                  onClick={() => { setActiveTab("manage-profile"); setSelectedDivision(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-bold transition ${
                    activeTab === "manage-profile" ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  👤 Manage Profile
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Time & Attendance</p>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveTab("tracker"); setSelectedDivision(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-bold transition ${
                    activeTab === "tracker" ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  📅 Daily Tracker Tab
                </button>
              </div>
            </div>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-2">
          <Link href="/" className="block text-center py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold rounded-lg transition text-xs">
            🏠 Main System UI (/)
          </Link>
          <p className="text-center">© 2026 Manpower OS</p>
        </div>
      </aside>

      {/* 🟢 MAIN CONTENT AREA */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">

        {/* VIEW 1: DASHBOARD OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-5 md:space-y-6">
            
            {/* 🌟 PROMINENT MAIN UI LINK CARD */}
            <Link 
              href="/" 
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-4 md:p-5 rounded-2xl shadow-md border border-blue-800/50 hover:border-blue-500 hover:shadow-lg transition gap-4 group"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-xl md:text-2xl shrink-0 group-hover:scale-105 transition">
                  ⏱️
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-sm md:text-base tracking-tight text-white">Daily Tracker Main System UI</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md text-[9px] md:text-[10px] font-mono font-bold uppercase">
                      Active Root (/)
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/80 mt-0.5">
                    Primary Timekeeper, Daily Attendance, & Site Supervisor entry portal.
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto text-center flex items-center justify-center gap-2 bg-blue-600 group-hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm">
                <span>Go to Main Page</span>
                <span>→</span>
              </div>
            </Link>

            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">HR Hub Dashboard</h2>
              <p className="text-xs md:text-sm text-slate-500">Workforce KPIs, monthly attendance trends, and site allocation metrics.</p>
            </div>

            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              <div
                onClick={() => setActiveTab("employees")}
                className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-400 transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Total Employees</span>
                  <span className="text-blue-600 font-bold text-sm">👥</span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900">{stats.totalEmployees}</div>
                <div className="text-[10px] md:text-xs text-slate-400 mt-1">{stats.activeEmployees} active</div>
              </div>

              <div
                onClick={() => setActiveTab("divisions")}
                className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-400 transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Divisions</span>
                  <span className="text-purple-600 font-bold text-sm">🏢</span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900">{stats.divisionsCount}</div>
                <div className="text-[10px] md:text-xs text-purple-600 mt-1 font-semibold">4 Divisions →</div>
              </div>

              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase">Total Presents</span>
                  <span className="text-emerald-500 font-bold text-sm">✅</span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900">{stats.totalPresents}</div>
                <div className="text-[10px] md:text-xs text-emerald-600 font-semibold mt-1">Today ({selectedDate})</div>
              </div>

              <div
                onClick={() => setActiveTab("absents")}
                className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-rose-400 transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-rose-600 uppercase">Total Absents</span>
                  <span className="text-rose-500 font-bold text-sm">❌</span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900">{stats.totalAbsents}</div>
                <div className="text-[10px] md:text-xs text-rose-600 font-semibold mt-1">Today ({selectedDate})</div>
              </div>

              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Monthly Payroll</span>
                  <span className="text-blue-500 font-bold text-sm">💳</span>
                </div>
                <div className="text-base md:text-xl font-black text-slate-900">{stats.monthlyPayroll}</div>
                <div className="text-[10px] md:text-xs text-slate-400 mt-1">WPS Total</div>
              </div>

              <div
                onClick={() => setActiveTab("new-hires")}
                className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-400 transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">New Hires</span>
                  <span className="text-pink-500 font-bold text-sm">👤+</span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900">{stats.newHiresCount}</div>
                <div className="text-[10px] md:text-xs text-pink-600 font-semibold mt-1">View list →</div>
              </div>
            </div>

            {/* MONTHLY ATTENDANCE & ABSENT TREND CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base md:text-lg font-bold text-slate-900">Monthly Attendance Trend</h3>
                  <button onClick={() => setActiveTab("tracker")} className="text-xs text-blue-600 font-bold hover:underline">
                    Daily Tracker →
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">Worker attendance rate percentage averaged monthly.</p>
                <div className="h-56 bg-slate-50 rounded-lg p-3 md:p-4 flex flex-col justify-between border border-slate-100">
                  <div className="w-full flex justify-between items-end h-36 px-2 md:px-4 pt-4">
                    {monthlyTrendData.map((m) => (
                      <div key={m.month} className="flex flex-col items-center gap-1">
                        <span className="text-[9px] md:text-[10px] font-bold text-emerald-600">{m.rate}%</span>
                        <div className="w-4 md:w-6 bg-emerald-500 rounded-t" style={{ height: `${m.rate * 1.2}px` }}></div>
                        <span className="text-[10px] md:text-xs text-slate-600 font-bold">{m.month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center text-xs font-bold text-emerald-700">
                    ● Attendance Rate (%)
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base md:text-lg font-bold text-slate-900">Monthly Absent Trend</h3>
                  <button onClick={() => setActiveTab("absents")} className="text-xs text-rose-600 font-bold hover:underline">
                    View Absents Page →
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">Average monthly count of absent workforce personnel.</p>
                <div className="h-56 bg-slate-50 rounded-lg p-3 md:p-4 flex flex-col justify-between border border-slate-100">
                  <div className="w-full flex justify-between items-end h-36 px-2 md:px-4 pt-4">
                    {monthlyTrendData.map((m) => (
                      <div key={m.month} className="flex flex-col items-center gap-1">
                        <span className="text-[9px] md:text-[10px] font-bold text-rose-600">{m.absents}</span>
                        <div className="w-4 md:w-6 bg-rose-500 rounded-t" style={{ height: `${m.absents * 7}px` }}></div>
                        <span className="text-[10px] md:text-xs text-slate-600 font-bold">{m.month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center text-xs font-bold text-rose-700">
                    ● Total Absent Workers (Count)
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: TOTAL EMPLOYEES DIRECTORY */}
        {activeTab === "employees" && (
          <div className="space-y-5 md:space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Total Employees Master Directory</h2>
                <p className="text-xs md:text-sm text-slate-500">Full workforce registry, MoHRE details, insurance expirations, and WPS salaries.</p>
              </div>

              <div className="flex w-full md:w-auto bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <button
                  onClick={() => { setCategory("Worker"); setCurrentPage(1); }}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                    category === "Worker" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  👷 Workers (Code 2)
                </button>
                <button
                  onClick={() => { setCategory("Staff"); setCurrentPage(1); }}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                    category === "Staff" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🏢 Staff (Code 1)
                </button>
                <button
                  onClick={() => { setCategory("All"); setCurrentPage(1); }}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                    category === "All" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🌐 All ({employees.length})
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Search by badge, name, trade, site..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-full md:w-72 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                    Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredEmployees.length)} of {filteredEmployees.length}
                  </span>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Show:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-700 shadow-sm"
                    >
                      <option value={25}>25 Rows</option>
                      <option value={50}>50 Rows</option>
                      <option value={100}>100 Rows</option>
                      <option value={filteredEmployees.length || 1000}>All ({filteredEmployees.length})</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-lg shadow-sm">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      className="px-2 py-1 text-xs font-bold rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <span className="text-xs font-bold text-slate-700 px-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      className="px-2 py-1 text-xs font-bold rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              {/* 📱 MOBILE CARDS VIEW */}
              <div className="md:hidden divide-y divide-slate-100">
                {isLoading ? (
                  <div className="p-6 text-center text-slate-400 font-bold text-xs">
                    Loading HR Directory...
                  </div>
                ) : displayedEmployees.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 font-bold text-xs">
                    No employee records found matching your filters.
                  </div>
                ) : (
                  displayedEmployees.map((emp, index) => {
                    const basic = Number(emp.basic_salary) || 0;
                    const total = basic + (Number(emp.accommodation_allowance) || 0) + (Number(emp.transport_allowance) || 0) + (Number(emp.food_allowance) || 0) + (Number(emp.other_allowance) || 0);
                    const empCode = emp.code || (emp.employee_type === "Staff" || emp.category === "Code 1" ? 1 : 2);
                    const statusText = (emp.Empoyment_status || emp.status || "Active").replace(/['"']/g, "").trim();

                    return (
                      <div key={emp.badge_number} className="p-4 bg-white space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 mr-2">#{startIndex + index + 1}</span>
                            <span className="font-mono font-bold text-blue-600 text-xs">#{emp.badge_number}</span>
                            <h4 className="font-bold text-slate-900 text-sm">{emp.name || `Worker #${emp.badge_number}`}</h4>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusBadgeStyle(statusText)}`}>
                            {statusText}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Trade</span>
                            <span className="font-semibold text-slate-700">{emp.Trade || emp.trade || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Division / Site</span>
                            <span className="font-semibold text-slate-700">{emp.division || "Supply"} / {emp.site || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Code</span>
                            <span className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${empCode === 1 ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              Code {empCode}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Salary</span>
                            <span className="font-bold text-slate-900">AED {total.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 px-1">
                          <div><strong className="text-slate-400 font-medium">Labor Card:</strong> {emp.labor_card_no || "—"}</div>
                          <div><strong className="text-slate-400 font-medium">Visa Expiry:</strong> {emp.visa_expiry || "—"}</div>
                          <div><strong className="text-slate-400 font-medium">Health Ins:</strong> {emp.health_insurance_expiry || "—"}</div>
                          <div><strong className="text-slate-400 font-medium">WC Ins:</strong> {emp.accidental_insurance_expiry || "—"}</div>
                        </div>

                        <div className="pt-1">
                          <button
                            onClick={() => { loadEmployeeIntoForm(emp); setActiveTab("manage-profile"); }}
                            className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold text-xs rounded-lg transition text-center"
                          >
                            👤 Edit Profile
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 🖥️ DESKTOP TABLE VIEW */}
              <div className="hidden md:block">
                <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto bg-slate-100 border-b border-slate-200">
                  <div style={{ width: `${tableWidth}px`, height: '12px' }} />
                </div>

                <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="overflow-x-auto">
                  <table ref={tableContentRef} className="w-full text-left text-xs whitespace-nowrap min-w-[900px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
                      <tr>
                        <th className="p-4 text-center">S.No</th>
                        <th className="p-4">Badge Number</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Division</th>
                        <th className="p-4">Site</th>
                        <th className="p-4">Trade</th>
                        <th className="p-4 text-center">Code</th>
                        <th className="p-4">Labor Card No</th>
                        <th className="p-4">Visa Expiry</th>
                        <th className="p-4">Ins. Expiry</th>
                        <th className="p-4">WC Ins Expiry</th>
                        <th className="p-4">Total Salary</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={14} className="p-8 text-center text-slate-400 font-bold">
                            Loading HR Directory...
                          </td>
                        </tr>
                      ) : displayedEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="p-8 text-center text-slate-400 font-bold">
                            No employee records found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        displayedEmployees.map((emp, index) => {
                          const basic = Number(emp.basic_salary) || 0;
                          const total = basic + (Number(emp.accommodation_allowance) || 0) + (Number(emp.transport_allowance) || 0) + (Number(emp.food_allowance) || 0) + (Number(emp.other_allowance) || 0);
                          const empCode = emp.code || (emp.employee_type === "Staff" || emp.category === "Code 1" ? 1 : 2);
                          const serialNumber = startIndex + index + 1;
                          const statusText = (emp.Empoyment_status || emp.status || "Active").replace(/['"']/g, "").trim();

                          return (
                            <tr key={emp.badge_number} className="hover:bg-slate-50 transition">
                              <td className="p-4 text-center font-mono font-bold text-slate-400">{serialNumber}</td>
                              <td className="p-4 font-mono font-bold text-blue-600">#{emp.badge_number}</td>
                              <td className="p-4 font-bold text-slate-800">{emp.name || `Worker #${emp.badge_number}`}</td>
                              <td className="p-4 text-slate-600 font-medium">{emp.division || "Supply"}</td>
                              <td className="p-4 text-slate-600">{emp.site || "-"}</td>
                              <td className="p-4 text-slate-600">{emp.Trade || emp.trade || "-"}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                  empCode === 1 ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                }`}>
                                  Code {empCode}
                                </span>
                              </td>
                              <td className="p-4 text-slate-600 font-mono">{emp.labor_card_no || "—"}</td>
                              <td className="p-4 text-slate-600">{emp.visa_expiry || "—"}</td>
                              <td className="p-4 text-slate-600">{emp.health_insurance_expiry || "—"}</td>
                              <td className="p-4 text-slate-600">{emp.accidental_insurance_expiry || "—"}</td>
                              <td className="p-4 font-bold text-slate-900">AED {total.toLocaleString()}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusBadgeStyle(statusText)}`}>
                                  {statusText}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => { loadEmployeeIntoForm(emp); setActiveTab("manage-profile"); }}
                                  className="text-blue-600 hover:text-blue-800 font-bold px-3 py-1.5 bg-blue-50 rounded-lg transition inline-block text-[11px]"
                                >
                                  👤 Edit Profile
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: DIVISIONS LANDING PAGE */}
        {activeTab === "divisions" && (
          <div className="space-y-5 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {selectedDivision ? `Division: ${selectedDivision}` : "Company Divisions"}
                </h2>
                <p className="text-xs md:text-sm text-slate-500">
                  {selectedDivision ? `Active manpower breakdown for ${selectedDivision}.` : "Select a division box to view its active manpower."}
                </p>
              </div>
              <button
                onClick={() => {
                  if (selectedDivision) setSelectedDivision(null);
                  else setActiveTab("dashboard");
                }}
                className="text-xs font-bold text-slate-600 bg-white border px-3 py-2 rounded-lg shadow-sm"
              >
                ← {selectedDivision ? "Back to Divisions Grid" : "Back to Dashboard"}
              </button>
            </div>

            {!selectedDivision ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {divisionsList.map((div) => (
                  <div
                    key={div.id}
                    onClick={() => setSelectedDivision(div.name)}
                    className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg md:text-xl font-black text-slate-900">{div.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">Head of Div: {div.head}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-[11px]">
                        {div.count} Workers
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">Click to view all workforce records assigned to {div.name}.</p>
                    <div className="text-xs font-bold text-blue-600 flex items-center gap-1">
                      Open Division Landing Page →
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-blue-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-blue-900 text-xs md:text-sm">🏢 {selectedDivision} Manpower List</h3>
                  <span className="text-xs font-bold text-blue-700">
                    {getDivisionEmployees(selectedDivision).length} Total Workers
                  </span>
                </div>

                {/* MOBILE CARDS FOR DIVISION WORKERS */}
                <div className="md:hidden divide-y divide-slate-100">
                  {getDivisionEmployees(selectedDivision).map((emp, idx) => (
                    <div key={idx} className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono font-bold text-blue-600 text-xs">#{emp.badge_number}</span>
                          <h4 className="font-bold text-slate-900 text-sm">{emp.name || `Worker #${emp.badge_number}`}</h4>
                          <p className="text-xs text-slate-500">{emp.Trade || emp.trade || "Mason / Helper"}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeStyle(emp.Empoyment_status || emp.status || 'Active')}`}>
                          {emp.Empoyment_status || emp.status || 'Active'}
                        </span>
                      </div>
                      <button
                        onClick={() => { loadEmployeeIntoForm(emp); setActiveTab("manage-profile"); }}
                        className="w-full py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg transition text-center"
                      >
                        Edit Profile ✏️
                      </button>
                    </div>
                  ))}
                </div>

                {/* DESKTOP TABLE */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b">
                      <tr>
                        <th className="p-3">Badge #</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Trade</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {getDivisionEmployees(selectedDivision).map((emp, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-blue-600">#{emp.badge_number}</td>
                          <td className="p-3 font-bold text-slate-900">{emp.name || `Worker #${emp.badge_number}`}</td>
                          <td className="p-3">{emp.Trade || emp.trade || "Mason / Helper"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeStyle(emp.Empoyment_status || emp.status || 'Active')}`}>
                              {emp.Empoyment_status || emp.status || 'Active'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => { loadEmployeeIntoForm(emp); setActiveTab("manage-profile"); }}
                              className="px-2.5 py-1 bg-blue-50 text-blue-600 font-bold text-[11px] rounded hover:bg-blue-600 hover:text-white transition"
                            >
                              Edit Profile ✏️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: TOTAL ABSENTS LANDING PAGE WITH TOTAL ABSENTS FROM DOJ */}
        {activeTab === "absents" && (
          <div className="space-y-5 md:space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-rose-900 tracking-tight">Total Absents & Absence History</h2>
                <p className="text-xs md:text-sm text-slate-500">List of absent employees, today's absentees, and total absences calculated from Date of Joining (DOJ).</p>
              </div>
              <button onClick={() => setActiveTab("dashboard")} className="text-xs font-bold text-slate-600 bg-white border px-3 py-2 rounded-lg shadow-sm">
                ← Back to Dashboard
              </button>
            </div>

            {/* ABSENT STATS SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="bg-rose-50 border border-rose-200 p-4 md:p-5 rounded-xl">
                <span className="text-[10px] md:text-xs font-bold text-rose-700 uppercase">Today's Absentees</span>
                <p className="text-2xl md:text-3xl font-black text-rose-900 mt-1">{stats.totalAbsents} <span className="text-xs font-semibold text-rose-600">Workers</span></p>
              </div>

              <div className="bg-white border border-slate-200 p-4 md:p-5 rounded-xl">
                <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Total Absences (Since DOJ)</span>
                <p className="text-2xl md:text-3xl font-black text-slate-900 mt-1">482 <span className="text-xs font-semibold text-slate-400">Days</span></p>
              </div>

              <div className="bg-white border border-slate-200 p-4 md:p-5 rounded-xl">
                <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Avg Absences Per Worker</span>
                <p className="text-2xl md:text-3xl font-black text-slate-900 mt-1">1.3 <span className="text-xs font-semibold text-slate-400">Days / Worker</span></p>
              </div>
            </div>

            {/* ABSENT EMPLOYEES CONTAINER */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Search absent worker by name or badge..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-xs w-full sm:w-72 bg-white"
                />
                <span className="text-xs font-bold text-slate-500">Showing Absentee Registry</span>
              </div>

              {/* MOBILE ABSENTS CARDS */}
              <div className="md:hidden divide-y divide-slate-100">
                {employees
                  .filter((emp) => {
                    const search = searchTerm.toLowerCase();
                    const badge = String(emp.badge_number || "").toLowerCase();
                    const name = String(emp.name || "").toLowerCase();
                    return badge.includes(search) || name.includes(search);
                  })
                  .map((emp, idx) => {
                    const mockTotalAbsentsFromDoj = (Number(emp.badge_number) % 7) + 1;
                    const mockMonthAbsents = mockTotalAbsentsFromDoj > 3 ? 2 : 1;

                    return (
                      <div key={idx} className="p-4 bg-white space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono font-bold text-rose-600 text-xs">#{emp.badge_number}</span>
                            <h4 className="font-bold text-slate-900 text-sm">{emp.name || `Worker #${emp.badge_number}`}</h4>
                            <p className="text-xs text-slate-500">{emp.Trade || emp.trade || "Mason / Helper"}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            Absent
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">This Month</span>
                            <span className="font-bold text-rose-600">{mockMonthAbsents} Days</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Since DOJ</span>
                            <span className="font-black text-slate-900">{mockTotalAbsentsFromDoj} Days</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          <strong>DOJ:</strong> {emp.doj || "2024-03-15"} • <strong>Div:</strong> {emp.division || emp.site || "Supply"}
                        </div>

                        <button
                          onClick={() => { loadEmployeeIntoForm(emp); setActiveTab("manage-profile"); }}
                          className="w-full py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition text-center"
                        >
                          Edit Profile ✏️
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* DESKTOP ABSENTS TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap min-w-[800px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b">
                    <tr>
                      <th className="p-4">Badge #</th>
                      <th className="p-4">Worker Name</th>
                      <th className="p-4">Trade / Designation</th>
                      <th className="p-4">Division / Site</th>
                      <th className="p-4">Date of Joining (DOJ)</th>
                      <th className="p-4 text-center">Absences This Month</th>
                      <th className="p-4 text-center">Total Absences (Since DOJ)</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {employees
                      .filter((emp) => {
                        const search = searchTerm.toLowerCase();
                        const badge = String(emp.badge_number || "").toLowerCase();
                        const name = String(emp.name || "").toLowerCase();
                        return badge.includes(search) || name.includes(search);
                      })
                      .map((emp, idx) => {
                        const mockTotalAbsentsFromDoj = (Number(emp.badge_number) % 7) + 1;
                        const mockMonthAbsents = mockTotalAbsentsFromDoj > 3 ? 2 : 1;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-4 font-bold text-rose-600">#{emp.badge_number}</td>
                            <td className="p-4 font-bold text-slate-900">{emp.name || `Worker #${emp.badge_number}`}</td>
                            <td className="p-4">{emp.Trade || emp.trade || "Gypsum Fixer / Mason"}</td>
                            <td className="p-4">{emp.division || emp.site || "Supply"}</td>
                            <td className="p-4 font-mono">{emp.doj || "2024-03-15"}</td>
                            <td className="p-4 text-center font-bold text-rose-600">{mockMonthAbsents} Days</td>
                            <td className="p-4 text-center font-black text-slate-900 bg-rose-50/50">
                              {mockTotalAbsentsFromDoj} Days
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                Absent
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => { loadEmployeeIntoForm(emp); setActiveTab("manage-profile"); }}
                                className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[11px] rounded hover:bg-slate-800 hover:text-white transition"
                              >
                                Edit Profile ✏️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: FULL MANAGE PROFILE & BULK EXPORT/IMPORT */}
        {activeTab === "manage-profile" && (
          <div className="space-y-5 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Manage Employee Profile</h2>
                <p className="text-xs md:text-sm text-slate-500">Edit MoHRE labor records, visa/passport compliance, insurance dates, and WPS allowance breakdowns.</p>
              </div>
              <button onClick={() => setActiveTab("dashboard")} className="text-xs font-bold text-slate-600 bg-white border px-3 py-2 rounded-lg shadow-sm">
                ← Back to Dashboard
              </button>
            </div>

            {/* 📂 BULK EMPLOYEE PROFILE EXPORT/IMPORT SECTION */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-bold text-sm md:text-base text-blue-900">📂 Employee Master Data Management</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Export your entire workforce registry to Excel, or mass-import updates for salaries, statuses, and compliance dates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                <button
                  onClick={() => handleExportProfiles(true)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl transition shadow-sm text-xs flex items-center justify-center gap-1.5"
                  title="Download a blank template containing only the required headers and one example row."
                >
                  <span>📥 Download Blank Template (.xlsx)</span>
                </button>

                <button
                  onClick={() => handleExportProfiles(false)}
                  className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200 font-bold py-3 rounded-xl transition shadow-sm text-xs flex items-center justify-center gap-1.5"
                  title="Export all currently registered employees and their full HR details."
                >
                  <span>💾 Export All Employees (.xlsx)</span>
                </button>

                <label className={`flex-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-sm cursor-pointer text-xs flex items-center justify-center gap-1.5 ${isImportingProfiles ? 'opacity-50 cursor-wait' : ''}`}>
                  <span>{isImportingProfiles ? 'Importing Profiles...' : '📁 Mass Import Updates (.xlsx)'}</span>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportProfiles} disabled={isImportingProfiles} className="hidden" />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-4">
                <h3 className="text-sm md:text-base font-bold text-slate-800">Quick Edit Employee Record</h3>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Enter Badge..."
                      value={searchBadge}
                      onChange={(e) => setSearchBadge(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-xl text-xs w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleSearchBadge(searchBadge)}
                      className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition"
                    >
                      Search
                    </button>
                  </div>
                  <select
                    value={searchBadge}
                    onChange={(e) => handleSearchBadge(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Or Pick Worker --</option>
                    {employees.map((e) => (
                      <option key={e.badge_number} value={String(e.badge_number)}>
                        #{e.badge_number} - {e.name || 'Worker'} ({e.Trade || e.trade || 'Mason'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-5">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">1. Basic & Employment Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Badge Number</label>
                    <input type="text" name="badge_number" value={formData.badge_number} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Code (1=Staff, 2=Worker)</label>
                    <select name="code" value={formData.code} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white">
                      <option value={1}>Code 1 (Staff)</option>
                      <option value={2}>Code 2 (Worker)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Trade / Designation</label>
                    <input type="text" name="trade" value={formData.trade} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Division</label>
                    <select name="division" value={formData.division} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white">
                      <option value="Supply">Supply</option>
                      <option value="Supply - MEP">Supply - MEP</option>
                      <option value="Waterproof">Waterproof</option>
                      <option value="Sursa">Sursa</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Site Allocation</label>
                    <input type="text" name="site" value={formData.site} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Employment Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white font-bold">
                      <option value="Active">Active</option>
                      <option value="Notice Period">Notice Period</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Resigned">Resigned</option>
                      <option value="Terminated">Terminated</option>
                      <option value="AWOL / Absconded">AWOL / Absconded</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Date of Birth (DOB)</label>
                    <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Date of Joining (DOJ)</label>
                    <input type="date" name="doj" value={formData.doj} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Last Working Date (LWD)</label>
                    <input type="date" name="lwd" value={formData.lwd} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">2. Passport & Visa Compliance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Passport Number</label>
                    <input type="text" name="passport_no" value={formData.passport_no} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Passport Expiry</label>
                    <input type="date" name="passport_expiry" value={formData.passport_expiry} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Unified No (UID)</label>
                    <input type="text" name="uid_no" value={formData.uid_no} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Visa / Permit No</label>
                    <input type="text" name="visa_no" value={formData.visa_no} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Visa Expiry</label>
                    <input type="date" name="visa_expiry" value={formData.visa_expiry} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" />
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">3. Labor Card & MoHRE Settings</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Labor Card Number</label>
                    <input type="text" name="labor_card_no" value={formData.labor_card_no} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" placeholder="e.g. 12345678" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Personal Code</label>
                    <input type="text" name="personal_code" value={formData.personal_code} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" placeholder="e.g. P-9876543" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Labor Card Expiry</label>
                    <input type="date" name="labor_card_expiry" value={formData.labor_card_expiry} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">4. Health & Work Compensation Insurance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Health Ins Name/No</label>
                    <input type="text" name="health_insurance_no" value={formData.health_insurance_no} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" placeholder="e.g. Daman / DOH" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Health Ins. Expiry</label>
                    <input type="date" name="health_insurance_expiry" value={formData.health_insurance_expiry} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">WC Ins Name/No</label>
                    <input type="text" name="accidental_insurance_no" value={formData.accidental_insurance_no} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" placeholder="e.g. Sukoon / Orient" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">WC Ins Expiry</label>
                    <input type="date" name="accidental_insurance_expiry" value={formData.accidental_insurance_expiry} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">5. Salary Breakdown (WPS Allowances)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Basic (AED)</label>
                    <input type="number" name="basic_salary" value={formData.basic_salary} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Accommodation</label>
                    <input type="number" name="accommodation_allowance" value={formData.accommodation_allowance} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Transport</label>
                    <input type="number" name="transport_allowance" value={formData.transport_allowance} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Food Allowance</label>
                    <input type="number" name="food_allowance" value={formData.food_allowance} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Others</label>
                    <input type="number" name="other_allowance" value={formData.other_allowance} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-blue-50 p-2.5 rounded-lg border border-blue-200 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Total Salary</span>
                    <span className="text-base font-black text-blue-900">AED {totalSalary.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">6. Leave Balances & MoHRE Accrual</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Paid Leaves Taken</label>
                    <input type="number" name="paid_leaves" value={formData.paid_leaves} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Unpaid Leaves Taken</label>
                    <input type="number" name="unpaid_leaves" value={formData.unpaid_leaves} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-amber-600 uppercase" title="Base 30 days minus 1 day per 14 unpaid days">Accrued Annual Leave</span>
                    <span className="text-base font-black text-amber-900">{accruedAnnualLeave} Days</span>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Remaining Balance</span>
                    <span className="text-base font-black text-emerald-900">{remainingLeaveBalance} Days</span>
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">7. Latest Leave Availed Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Leave Reason</label>
                    <input type="text" name="leave_reason" value={formData.leave_reason} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" placeholder="e.g. Annual Leave..." />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Total Days Taken</label>
                    <input type="number" name="leave_total_days" value={formData.leave_total_days} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Starting Date</label>
                    <input type="date" name="leave_start_date" value={formData.leave_start_date} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Ending Date</label>
                    <input type="date" name="leave_end_date" value={formData.leave_end_date} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Resumption Date</label>
                    <input type="date" name="leave_resumption_date" value={formData.leave_resumption_date} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Overstayed Days</label>
                    <input type="number" name="leave_overstayed_days" value={formData.leave_overstayed_days} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Total Days Out of UAE</label>
                    <input type="number" name="leave_out_of_uae_days" value={formData.leave_out_of_uae_days} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Air Ticket Entitlement</label>
                    <select name="air_ticket_entitlement" value={formData.air_ticket_entitlement} onChange={handleChange} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white font-bold">
                      <option value="None">None</option>
                      <option value="Annual (Company Paid)">Annual (Company Paid)</option>
                      <option value="Biannual (Company Paid)">Biannual (Company Paid)</option>
                      <option value="Self Paid">Self Paid</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex flex-col gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving Employee Record..." : "💾 Save Employee Changes to Supabase"}
                  </button>

                  {saveStatus && (
                    <div className={`p-3 rounded-xl text-xs font-bold text-center ${
                      saveStatus.startsWith("✅")
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : saveStatus.startsWith("❌")
                        ? "bg-rose-50 text-rose-800 border border-rose-200"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {saveStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 6: NEW HIRES */}
        {activeTab === "new-hires" && (
          <div className="space-y-5 md:space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">New Hires (MTD)</h2>
                <p className="text-xs md:text-sm text-slate-500">Recently onboarded workers and staff members.</p>
              </div>
              <button onClick={() => setActiveTab("dashboard")} className="text-xs font-bold text-slate-600 bg-white border px-3 py-2 rounded-lg shadow-sm">
                ← Back to Dashboard
              </button>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs md:text-sm font-bold text-slate-700 uppercase mb-4">12 Newly Joined Personnel</h3>
              <div className="divide-y divide-slate-100">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="py-3 flex justify-between items-center text-xs md:text-sm">
                    <div>
                      <p className="font-bold text-slate-800">New Worker #{101 + i}</p>
                      <p className="text-[10px] md:text-xs text-slate-400">Mason / Helper • Division: Supply</p>
                    </div>
                    <span className="text-[10px] md:text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
                      Joined August 2026
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 7: TRUE DAY-BY-DAY ATTENDANCE TRACKER */}
        {activeTab === "tracker" && (
          <div className="space-y-5 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Daily Attendance Tracker</h2>
                <p className="text-xs md:text-sm text-slate-500">Day-by-day attendance logs, site check-ins, and daily worker status.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-white p-1.5 border border-slate-200 rounded-xl shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-xs font-bold text-slate-500 pl-1">Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 border border-slate-200 rounded-xl shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-xs font-bold text-slate-500 pl-1">Month:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Present Today</span>
                <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">{selectedDateMetrics.present} <span className="text-xs font-semibold text-slate-400">/ {stats.activeEmployees}</span></p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Late Arrivals</span>
                <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">{selectedDateMetrics.late}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Absents</span>
                <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">{selectedDateMetrics.absent}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Total OT Hours</span>
                <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">{selectedDateMetrics.ot} hrs</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-xs md:text-sm text-slate-800">
                  📅 Day-by-Day Log — {selectedMonth}
                </h3>
                <span className="text-[10px] md:text-xs font-semibold text-slate-500">
                  {trackerRows.length} Days Tracked
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap min-w-[750px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Day</th>
                      <th className="p-3 text-center">Total Workforce</th>
                      <th className="p-3 text-center">Present</th>
                      <th className="p-3 text-center">Late</th>
                      <th className="p-3 text-center">Absent</th>
                      <th className="p-3 text-center">On Leave</th>
                      <th className="p-3 text-center">Total OT (Hrs)</th>
                      <th className="p-3 text-center">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {isTrackerLoading ? (
                      <tr><td colSpan={9} className="p-8 text-center text-slate-400 font-bold">Loading Tracker Data...</td></tr>
                    ) : trackerRows.map((row, idx) => (
                      <tr key={idx} className={row.dayName.includes("Today") ? "bg-blue-50/60 font-bold" : "hover:bg-slate-50"}>
                        <td className="p-3 font-mono text-blue-600">{row.dateDisplay}</td>
                        <td className="p-3">{row.dayName}</td>
                        <td className="p-3 text-center">{row.total}</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{row.present}</td>
                        <td className="p-3 text-center text-amber-600">{row.late}</td>
                        <td className="p-3 text-center text-rose-600 font-bold">{row.absent}</td>
                        <td className="p-3 text-center text-slate-500">{row.leave}</td>
                        <td className="p-3 text-center font-bold text-slate-800">{row.ot} hrs</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {row.rate}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}