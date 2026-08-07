"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FaceDetector from '../components/FaceDetector';
import FaceRegistration from '../components/FaceRegistration';
import * as XLSX from 'xlsx';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const FALLBACK_SITES = [
  'Vida', 'Vida supply', 'City walk', 'City walk supply', 'City walk painters', 
  'Venera Waterproof', 'Venera Conversion', 'Burj Khalifa', 'Rivera', 
  'Camps', 'Drivers', 'Head Office'
];
const FALLBACK_DIVISIONS = ['Supply', 'Sursa', 'Waterproof', 'Supply-MEP'];
const STATUS_OPTIONS = ['Active', 'Transfer', 'Notice Period', 'Resigned', 'Vacation', 'Absconded'];

// 🧠 DUH PROTOCOL: Present + Week Off + Sick = Total Worked Days. Leave is NOT deducted.
function calculatePayrollStats(physicalPresent: number, weekOffs: number, sickDays: number, leaveDays: number, selectedYear: number, selectedMonth: number) {
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  if (physicalPresent === 0 && weekOffs === 0 && sickDays === 0 && leaveDays === 0) {
    return { present: 0, weekOff: 0, sick: 0, leave: 0, totalWorkedDays: 0, absent: daysInMonth };
  }

  // Exact DUH Math: Total Worked Days = Present + Week Off + Sick
  const totalWorkedDays = physicalPresent + weekOffs + sickDays;

  // Absent calculation: Days in month minus all accounted days (worked + leave)
  const absentDays = Math.max(0, daysInMonth - (totalWorkedDays + leaveDays));

  return { 
    present: physicalPresent, 
    weekOff: weekOffs, 
    sick: sickDays, 
    leave: leaveDays, 
    totalWorkedDays: totalWorkedDays, 
    absent: absentDays 
  };
}

export default function TimesheetTracker() {
  const [authRole, setAuthRole] = useState<'admin' | 'timekeeper' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 🌓 Theme Mode State (Defaults to dark matching HR Hub)
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [activeTab, setActiveTab] = useState<'daily' | 'payroll' | 'reports' | 'settings'>('daily');
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [attendance, setAttendance] = useState<Record<string, 'Present' | 'Absent' | 'Sick' | 'Leave' | 'Week Off' | ''>>({});
  const [clockIn, setClockIn] = useState<Record<string, string>>({});
  const [clockOut, setClockOut] = useState<Record<string, string>>({});
  const [geoCoords, setGeoCoords] = useState<string>('Location unavailable');
  
  const [activityLogs, setActivityLogs] = useState<{ id: string; time: string; message: string; type: 'in' | 'out' }[]>([]);

  const [overtime, setOvertime] = useState<Record<string, number>>({});
  
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showMissingPunches, setShowMissingPunches] = useState(false);

  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [isPayrollLoading, setIsPayrollLoading] = useState(false);

  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportSelectedBadge, setReportSelectedBadge] = useState('All');
  const [reportSelectedSite, setReportSelectedSite] = useState('All Sites');
  const [reportSelectedDivision, setReportSelectedDivision] = useState('All Divisions');
  const [reportSelectedAttendance, setReportSelectedAttendance] = useState('All');
  const [reportRecords, setReportRecords] = useState<any[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [importMonth, setImportMonth] = useState(new Date().toISOString().slice(0, 7));

  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [editForm, setEditForm] = useState({ site: '', Empoyment_status: '', status_date: '', division: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [dbSites, setDbSites] = useState<string[]>([]);
  const [dbDivisions, setDbDivisions] = useState<string[]>([]);
  const [newSiteInput, setNewSiteInput] = useState('');
  const [newDivisionInput, setNewDivisionInput] = useState('');

  const [newEmpForm, setNewEmpForm] = useState({ badge_number: '', name: '', Trade: '', division: '', site: '' });
  const [isAddingEmp, setIsAddingEmp] = useState(false);

  const [searchBadge, setSearchBadge] = useState('');
  const [searchName, setSearchName] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('All Trades');
  const [selectedDivision, setSelectedDivision] = useState('All Divisions');
  const [selectedSite, setSelectedSite] = useState('All Sites');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedAttendance, setSelectedAttendance] = useState('All');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userEmail = session.user.email || '';
        if (userEmail.toLowerCase().includes('admin')) setAuthRole('admin');
        else setAuthRole('timekeeper');
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setGeoCoords(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`),
        () => setGeoCoords('Permission Denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginError(error.message);
      return;
    }

    if (data.user?.email?.toLowerCase().includes('admin')) {
      setAuthRole('admin');
    } else {
      setAuthRole('timekeeper');
      setActiveTab('daily'); 
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthRole(null);
    setEmail('');
    setPassword('');
  };

  useEffect(() => {
    async function fetchData() {
      try {
        if (supabaseUrl === 'https://placeholder.supabase.co') return;
        
        const { data: empData, error: empErr } = await supabase.from('employees').select('*');
        if (empErr) throw empErr;
        
        setEmployees((empData || []).map(emp => ({
          ...emp,
          Trade: emp.Trade || emp.trade || 'N/A',
          division: emp.division || '',
          Empoyment_status: emp.Empoyment_status?.replace(/'/g, '') || 'Active',
          status_date: emp.status_date || ''
        })));

        const [{ data: sData, error: sErr }, { data: dData, error: dErr }] = await Promise.all([
          supabase.from('sites').select('name'),
          supabase.from('divisions').select('name')
        ]);

        if (sErr || !sData || sData.length === 0) setDbSites(FALLBACK_SITES);
        else setDbSites(sData.map(s => s.name));

        if (dErr || !dData || dData.length === 0) setDbDivisions(FALLBACK_DIVISIONS);
        else setDbDivisions(dData.map(d => d.name));

      } catch (err: any) { 
          setErrorMessage(err.message || "Failed to load database. Check Row Level Security."); 
          setDbSites(FALLBACK_SITES);
          setDbDivisions(FALLBACK_DIVISIONS);
      } finally { 
          setIsLoading(false); 
      }
    }
    fetchData();
  }, [authRole]);

  useEffect(() => {
    async function fetchDailyAttendance() {
      if (supabaseUrl === 'https://placeholder.supabase.co' || !authRole) return;
      const { data } = await supabase.from('daily_attendance').select('*').eq('date', currentDate);
      
      const att: any = {}; 
      const ovt: any = {};
      const cIn: any = {};
      const cOut: any = {};

      (data || []).forEach(r => { 
        att[r.badge_number] = r.attendance_status; 
        ovt[r.badge_number] = r.overtime_hours; 
        cIn[r.badge_number] = r.clock_in || '';
        cOut[r.badge_number] = r.clock_out || '';
      });
      
      setAttendance(att); 
      setOvertime(ovt);
      setClockIn(cIn);
      setClockOut(cOut);
      setLastSyncTime('');
      setHasUnsavedChanges(false);
    }
    fetchDailyAttendance();
  }, [currentDate, authRole]);

  const saveDailyAttendance = async (silent = false) => {
    setIsSavingAttendance(true);
    await supabase.from('daily_attendance').delete().eq('date', currentDate);
    
    const records = employees
      .filter(e => e.Empoyment_status === 'Active' || (e.Empoyment_status === 'Notice Period' && (!e.status_date || currentDate <= e.status_date)))
      .filter(e => attendance[e.badge_number] && attendance[e.badge_number] !== '')
      .map(e => ({
        date: currentDate, 
        badge_number: e.badge_number,
        attendance_status: attendance[e.badge_number],
        overtime_hours: attendance[e.badge_number] === 'Present' ? (overtime[e.badge_number] || 0) : 0,
        clock_in: clockIn[e.badge_number] || null,
        clock_out: clockOut[e.badge_number] || null,
        location: geoCoords
      }));
      
    if (records.length > 0) {
      await supabase.from('daily_attendance').insert(records);
    }
    setIsSavingAttendance(false);
    if (!silent) alert("Daily data saved successfully!");
  };

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    
    const timer = setTimeout(() => {
      saveDailyAttendance(true);
      setHasUnsavedChanges(false);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 2000); 
    
    return () => clearTimeout(timer);
  }, [attendance, clockIn, clockOut, overtime, hasUnsavedChanges]);

  // 🚀 BYPASS SUPABASE THUMB RULE: Downloads all records using unlimited chunking
  useEffect(() => {
    async function generatePayroll() {
      if (activeTab !== 'payroll' || supabaseUrl === 'https://placeholder.supabase.co') return;
      setIsPayrollLoading(true);
      
      try {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('daily_attendance')
            .select('*')
            .gte('date', `${payrollMonth}-01`)
            .lte('date', `${payrollMonth}-31`)
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
        
        const tally: Record<string, any> = {};
        employees.forEach(e => tally[e.badge_number] = { ...e, physicalPresent: 0, weekOffs: 0, sickDays: 0, leaveDays: 0, totalOvertime: 0 });
        
        allData.forEach(r => {
          if (tally[r.badge_number]) {
            const status = (r.attendance_status || '').toLowerCase();
            if (status === 'present') tally[r.badge_number].physicalPresent += 1;
            else if (status === 'week off') tally[r.badge_number].weekOffs += 1;
            else if (status === 'sick') tally[r.badge_number].sickDays += 1;
            else if (status === 'leave') tally[r.badge_number].leaveDays += 1;
            
            tally[r.badge_number].totalOvertime += (r.overtime_hours || 0);
          }
        });

        const [yearStr, monthStr] = payrollMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        Object.values(tally).forEach(emp => {
           const stats = calculatePayrollStats(emp.physicalPresent, emp.weekOffs, emp.sickDays, emp.leaveDays, year, month);
           emp.totalPresent = stats.present;
           emp.weekOff = stats.weekOff;
           emp.sick = stats.sick;
           emp.leave = stats.leave;
           emp.totalWorkedDays = stats.totalWorkedDays;
           emp.totalAbsent = stats.absent;
        });

        setPayrollData(Object.values(tally));
      } catch (err: any) {
        console.error("Payroll Error:", err.message);
      } finally {
        setIsPayrollLoading(false);
      }
    }
    generatePayroll();
  }, [payrollMonth, activeTab, employees]);

  // 🚀 BYPASS SUPABASE THUMB RULE: Chunked fetching for reports
  const generateCustomReport = async () => {
    if (supabaseUrl === 'https://placeholder.supabase.co') return;
    setIsReportLoading(true);
    
    try {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('daily_attendance')
          .select('*')
          .gte('date', reportStartDate)
          .lte('date', reportEndDate)
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

      const empMap = new Map(employees.map(e => [e.badge_number, e]));
      const combined = allData.map(r => {
        const emp: any = empMap.get(r.badge_number) || {};
        return {
          ...r,
          name: emp.name || 'Unknown',
          Trade: emp.Trade || emp.trade || 'N/A',
          division: emp.division || '',
          site: emp.site || 'N/A',
          Empoyment_status: emp.Empoyment_status || 'Active'
        };
      });

      setReportRecords(combined);
    } catch (err: any) {
      console.error('Error fetching custom report:', err.message);
    } finally {
      setIsReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports' && employees.length > 0) {
      generateCustomReport();
    }
  }, [activeTab, reportStartDate, reportEndDate, employees]);

  // 🎯 MATRIX EXCEL & CSV IMPORT PARSER WITH MONTH ROLLOVER SUPPORT
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingCSV(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const [yearStr, monthStr] = importMonth.split('-');

        const dailyData: Record<string, Record<string, { status: string | null; ot: number }>> = {};
        const skippedBadges = new Set<string>();

        let headerRowIdx = -1;
        let badgeColIdx = -1;
        let typeColIdx = -1; 
        const dayCols: Record<number, number> = {};

        for (let r = 0; r < Math.min(rows.length, 30); r++) {
          const row = rows[r];
          if (!row) continue;
          
          let foundDays = 0;
          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim().toUpperCase();
            
            if (cellVal.includes('BADGE') || cellVal.includes('CODE')) badgeColIdx = c;
            
            const numVal = parseInt(cellVal, 10);
            if (!isNaN(numVal) && numVal >= 1 && numVal <= 31 && cellVal === String(numVal)) {
               dayCols[numVal] = c;
               foundDays++;
            }
          }
          if (badgeColIdx !== -1 && dayCols[1] !== undefined) {
            headerRowIdx = r;
            break;
          }
        }

        if (headerRowIdx === -1) {
           throw new Error("Could not detect headers. Ensure the sheet has a 'BADGE' or 'CODE' column and numbered days.");
        }

        for (let r = headerRowIdx + 1; r < Math.min(rows.length, headerRowIdx + 20); r++) {
           const row = rows[r];
           if (!row) continue;
           for (let c = 0; c < row.length; c++) {
              const cellVal = String(row[c] || '').trim().toUpperCase();
              if (cellVal === 'ATTENDANCE' || cellVal === 'OVERTIME' || cellVal === 'OT' || cellVal === 'NOTES' || cellVal === 'DATE') {
                 typeColIdx = c;
                 break;
              }
           }
           if (typeColIdx !== -1) break;
        }

        if (typeColIdx === -1) {
            typeColIdx = dayCols[1] - 1; 
        }

        let currentBadge = '';

        // Calculate previous month string for 25th to 24th payroll cycles
        const [yearNum, monthNum] = importMonth.split('-').map(Number);
        const prevMonthDate = new Date(yearNum, monthNum - 2, 1);
        const prevYearStr = prevMonthDate.getFullYear().toString();
        const prevMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const day1Col = dayCols[1];

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawBadgeCol = String(row[badgeColIdx] || '').trim();
          if (rawBadgeCol !== '') {
            const parsedBadge = parseInt(rawBadgeCol.replace(/\D/g, ''), 10);
            if (!isNaN(parsedBadge) && parsedBadge > 0) {
              currentBadge = String(parsedBadge);
            }
          }

          if (!currentBadge) continue;

          const rowType = String(row[typeColIdx] || '').trim().toUpperCase();
          if (rowType === 'NOTES') continue; 
          
          const isAttendance = rowType === 'ATTENDANCE' || rowType === '' || rowType === 'P';
          const isOvertime = rowType === 'OVERTIME' || rowType === 'OT';

          if (!isAttendance && !isOvertime) continue;

          const isRegistered = employees.some(emp => String(emp.badge_number) === currentBadge);
          if (!isRegistered) {
            skippedBadges.add(currentBadge);
            continue;
          }

          if (!dailyData[currentBadge]) dailyData[currentBadge] = {};

          for (let day = 1; day <= 31; day++) {
            const colIdx = dayCols[day];
            if (colIdx === undefined || colIdx >= row.length) continue;

            const cellVal = String(row[colIdx] || '').trim().toUpperCase();
            if (!cellVal) continue;

            // Handle date calculation across month boundaries
            let dateStr: string;
            if (day1Col !== undefined && colIdx < day1Col && day > 15) {
              dateStr = `${prevYearStr}-${prevMonthStr}-${String(day).padStart(2, '0')}`;
            } else {
              dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
            }

            if (!dailyData[currentBadge][dateStr]) {
              dailyData[currentBadge][dateStr] = { status: null, ot: 0 };
            }

            if (isAttendance) {
              if (cellVal === 'P' || cellVal === 'PRESENT') dailyData[currentBadge][dateStr].status = 'Present';
              else if (cellVal === 'SL' || cellVal === 'SICK') dailyData[currentBadge][dateStr].status = 'Sick';
              else if (cellVal === 'L' || cellVal === 'LEAVE') dailyData[currentBadge][dateStr].status = 'Leave';
              else if (cellVal === 'A' || cellVal === 'ABSENT') dailyData[currentBadge][dateStr].status = 'Absent';
              else if (cellVal === 'OFF' || cellVal === 'WEEK OFF' || cellVal === 'W/O') dailyData[currentBadge][dateStr].status = 'Week Off';
            } else if (isOvertime) {
              const otVal = parseFloat(cellVal);
              if (!isNaN(otVal) && otVal > 0) {
                dailyData[currentBadge][dateStr].ot = otVal;
              }
            }
          }
        }

        // Database Upsert with Chunking
        const recordsToUpsert: any[] = [];

        Object.keys(dailyData).forEach(badgeStr => {
          const daysMap = dailyData[badgeStr];
          Object.keys(daysMap).forEach(dateStr => {
            const { status, ot } = daysMap[dateStr];
            if (status || ot > 0) {
              recordsToUpsert.push({
                date: dateStr,
                badge_number: parseInt(badgeStr, 10),
                attendance_status: status || 'Present',
                clock_in: null,
                clock_out: null,
                overtime_hours: ot,
                location: 'Imported via Excel Matrix'
              });
            }
          });
        });

        if (recordsToUpsert.length > 0) {
          const BATCH_SIZE = 1000;
          for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
              .from('daily_attendance')
              .upsert(batch, { onConflict: 'date,badge_number' });

            if (error) throw error;
          }

          let msg = `✅ Success! Processed ${recordsToUpsert.length} records across ${Object.keys(dailyData).length} employees.`;
          if (skippedBadges.size > 0) {
            msg += `\n\n⚠️ ${skippedBadges.size} unregistered badges skipped: ${Array.from(skippedBadges).join(', ')}`;
          }
          alert(msg);
          await generateCustomReport();
        } else {
          alert('❌ No matching employee records found to import.');
        }
      } catch (err: any) {
        alert('Import Error: ' + err.message);
      } finally {
        setIsImportingCSV(false);
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 📊 EXPORT MATRIX TIMESHEET (.xlsx) & BLANK FORMAT TEMPLATE (.xlsx)
  const handleExportMatrixTimesheet = async (monthToExport?: string, templateOnly: boolean = false) => {
    const monthStr = monthToExport || importMonth || payrollMonth || currentDate.slice(0, 7);
    const [yearStr, mStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch month attendance data if not templateOnly
    let monthAttendanceMap: Record<string, Record<string, { status: string; ot: number }>> = {};
    
    if (!templateOnly && supabaseUrl !== 'https://placeholder.supabase.co') {
      try {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('daily_attendance')
            .select('*')
            .gte('date', `${monthStr}-01`)
            .lte('date', `${monthStr}-31`)
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

        allData.forEach((r) => {
          const badge = String(r.badge_number);
          if (!monthAttendanceMap[badge]) monthAttendanceMap[badge] = {};
          monthAttendanceMap[badge][r.date] = {
            status: r.attendance_status || '',
            ot: r.overtime_hours || 0,
          };
        });
      } catch (err: any) {
        console.error('Error fetching month attendance for matrix export:', err.message);
      }
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const row0: any[] = ['SL No.', 'Code No.', 'Name', 'Designation', 'Site', 'Date'];
    const row1: any[] = ['', '', '', '', '', ''];

    for (let day = 1; day <= daysInMonth; day++) {
      row0.push(day);
      const dt = new Date(year, month - 1, day);
      row1.push(dayNames[dt.getDay()]);
    }

    const matrixRows: any[][] = [row0, row1];

    employees.forEach((emp, idx) => {
      const badgeStr = String(emp.badge_number);
      const rAtt: any[] = [idx + 1, emp.badge_number, emp.name, emp.Trade || emp.trade || 'N/A', emp.site || 'N/A', 'Attendance'];
      const rOt: any[] = ['', '', '', '', '', 'Overtime'];

      for (let day = 1; day <= daysInMonth; day++) {
        const dPadded = String(day).padStart(2, '0');
        const dateStr = `${monthStr}-${dPadded}`;

        let code = '';
        let otVal: any = '';

        if (!templateOnly) {
          const rec = monthAttendanceMap[badgeStr]?.[dateStr] || 
            (dateStr === currentDate ? { status: attendance[badgeStr] || '', ot: overtime[badgeStr] || 0 } : null);

          if (rec) {
            const st = rec.status;
            if (st === 'Present') code = 'P';
            else if (st === 'Week Off') code = 'Off';
            else if (st === 'Sick') code = 'SL';
            else if (st === 'Leave') code = 'L';
            else if (st === 'Absent') code = 'A';

            if (rec.ot > 0) otVal = rec.ot;
          }
        }

        rAtt.push(code);
        rOt.push(otVal);
      }

      matrixRows.push(rAtt);
      matrixRows.push(rOt);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, ws, `Timesheet ${monthStr}`);
    const filename = templateOnly 
      ? `Matrix_Timesheet_Template_${monthStr}.xlsx` 
      : `Matrix_Timesheet_${monthStr}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleAddSite = async () => {
    if (!newSiteInput.trim()) return;
    const site = newSiteInput.trim();
    setDbSites(prev => [...prev, site]); 
    setNewSiteInput('');
    await supabase.from('sites').insert([{ name: site }]);
  };

  const handleDeleteSite = async (siteName: string) => {
    setDbSites(prev => prev.filter(s => s !== siteName));
    await supabase.from('sites').delete().eq('name', siteName);
  };

  const handleAddDivision = async () => {
    if (!newDivisionInput.trim()) return;
    const div = newDivisionInput.trim();
    setDbDivisions(prev => [...prev, div]); 
    setNewDivisionInput('');
    await supabase.from('divisions').insert([{ name: div }]);
  };

  const handleDeleteDivision = async (divName: string) => {
    setDbDivisions(prev => prev.filter(d => d !== divName));
    await supabase.from('divisions').delete().eq('name', divName);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingEmp(true);
    const { badge_number, name, Trade, division, site } = newEmpForm;

    if (!badge_number || !name) {
      alert('Badge Number and Name are required.');
      setIsAddingEmp(false);
      return;
    }

    const newEmployee = {
      badge_number: parseInt(badge_number),
      name,
      Trade,
      division,
      site,
      Empoyment_status: 'Active',
      status_date: null
    };

    const { error } = await supabase.from('employees').insert([newEmployee]);

    if (error) {
      alert('Error adding employee: ' + error.message);
    } else {
      setEmployees(prev => [...prev, { ...newEmployee, status_date: '' }]);
      setNewEmpForm({ badge_number: '', name: '', Trade: '', division: '', site: '' });
      alert(`✅ ${name} added successfully!`);
    }
    setIsAddingEmp(false);
  };

  const handleDeleteEmployee = async (badge_number: string, name: string) => {
    if (!window.confirm(`⚠️ ARE YOU SURE?\n\nYou are about to permanently delete [ ${badge_number} - ${name} ].\n\nThis cannot be undone.`)) return;

    setIsSaving(true);
    const { error } = await supabase.from('employees').delete().eq('badge_number', badge_number);

    if (error) {
      alert('Error deleting employee: ' + error.message);
    } else {
      setEmployees(prev => prev.filter(e => e.badge_number !== badge_number));
      setEditingEmployee(null);
      alert(`🗑️ ${name} has been removed from the system.`);
    }
    setIsSaving(false);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const exportDaily = () => {
    const mapsLink = geoCoords.includes(',') && !geoCoords.includes('Denied') 
      ? `https://www.google.com/maps/search/?api=1&query=${geoCoords}` 
      : geoCoords;

    const headers = ['S.No', 'Date', 'Badge', 'Name', 'Trade', 'Division', 'Site', 'Status', 'Status Date', 'Attendance', 'Clock In', 'Clock Out', 'Overtime', 'Location Map'];
    const rows = filtered.map((e, i) => [
      i+1, currentDate, e.badge_number, e.name, e.Trade, e.division || '', e.site, e.Empoyment_status, e.status_date, 
      attendance[e.badge_number] || 'Unmarked', clockIn[e.badge_number] || '', clockOut[e.badge_number] || '', 
      overtime[e.badge_number] || 0, `"${mapsLink}"`
    ]);
    downloadCSV([headers, ...rows].map(r => r.join(',')).join('\n'), `Daily_Timesheet_${currentDate}.csv`);
  };

  const exportPayroll = () => {
    const headers = ['Badge', 'Name', 'Trade', 'Division', 'Site', 'Status', 'Present', 'Week Off', 'Sick', 'Leave', 'Total Worked Days', 'Absent', 'Overtime'];
    const rows = filteredPayroll.map(e => [e.badge_number, e.name, e.Trade, e.division || '', e.site, e.Empoyment_status, e.totalPresent, e.weekOff, e.sick, e.leave, e.totalWorkedDays, e.totalAbsent, e.totalOvertime]);
    downloadCSV([headers, ...rows].map(r => r.join(',')).join('\n'), `Payroll_${payrollMonth}.csv`);
  };

  const exportReportCSV = () => {
    const headers = ['Date', 'Badge', 'Name', 'Trade', 'Department/Division', 'Site', 'Attendance Status', 'Clock In', 'Clock Out', 'Overtime (Hours)', 'Location'];
    const rows = filteredReportRecords.map(r => [
      r.date, r.badge_number, r.name, r.Trade, r.division || '', r.site, r.attendance_status, 
      r.clock_in || '', r.clock_out || '', r.overtime_hours || 0, `"${r.location || ''}"`
    ]);
    downloadCSV([headers, ...rows].map(row => row.join(',')).join('\n'), `Attendance_Report_${reportStartDate}_to_${reportEndDate}.csv`);
  };

  const saveEmployeeChanges = async () => {
    setIsSaving(true);
    const finalDateToSave = editForm.Empoyment_status === 'Active' ? null : (editForm.status_date || null);
    
    await supabase.from('employees').update({ 
      site: editForm.site, 
      Empoyment_status: editForm.Empoyment_status, 
      status_date: finalDateToSave,
      division: editForm.division 
    }).eq('badge_number', editingEmployee.badge_number);
    
    setEmployees(prev => prev.map(e => e.badge_number === editingEmployee.badge_number ? { 
      ...e, 
      site: editForm.site, 
      Empoyment_status: editForm.Empoyment_status, 
      status_date: finalDateToSave || '',
      division: editForm.division 
    } : e));
    
    setEditingEmployee(null); setIsSaving(false);
  };

  const handleAttendanceChange = (badgeNumber: string, value: string) => {
    setHasUnsavedChanges(true);
    setAttendance(prev => {
      const newAtt = { ...prev, [badgeNumber]: value as any };
      
      if (value === 'Present' && !prev[badgeNumber]) {
        const now = new Date();
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setClockIn(c => ({...c, [badgeNumber]: timeString}));
      }
      return newAtt;
    });
  };

  const missingPunchesCount = useMemo(() => {
    return employees.filter(e => attendance[e.badge_number] === 'Present' && clockIn[e.badge_number] && !clockOut[e.badge_number]).length;
  }, [employees, attendance, clockIn, clockOut]);

  const uniqueSites = Array.from(new Set([...dbSites, ...employees.map(e => e.site).filter(Boolean)]));
  const uniqueDivisions = Array.from(new Set([...dbDivisions, ...employees.map(e => e.division).filter(Boolean)]));
  const uniqueTrades = Array.from(new Set(employees.map(e => e.Trade).filter(Boolean))) as string[];
  
  const filtered = useMemo(() => {
    return employees.filter(e => {
      const empAtt = attendance[e.badge_number] || 'Unmarked';
      const hasClockIn = !!clockIn[e.badge_number];
      const hasClockOut = !!clockOut[e.badge_number];
      
      if (showMissingPunches && !(empAtt === 'Present' && hasClockIn && !hasClockOut)) {
        return false;
      }

      const matchBadge = String(e.badge_number || '').toLowerCase().includes(searchBadge.toLowerCase());
      const matchName = String(e.name || '').toLowerCase().includes(searchName.toLowerCase());
      const matchTrade = selectedTrade === 'All Trades' || e.Trade === selectedTrade;
      const matchDivision = selectedDivision === 'All Divisions' || e.division === selectedDivision;
      const matchSite = selectedSite === 'All Sites' || e.site === selectedSite;
      const matchStatus = selectedStatus === 'All Statuses' || e.Empoyment_status === selectedStatus;
      const matchAttendance = selectedAttendance === 'All' || empAtt === selectedAttendance;
      
      return matchBadge && matchName && matchTrade && matchDivision && matchSite && matchStatus && matchAttendance;
    });
  }, [employees, searchBadge, searchName, selectedTrade, selectedDivision, selectedSite, selectedStatus, selectedAttendance, attendance, clockIn, clockOut, showMissingPunches]);

  const filteredPayroll = useMemo(() => {
    return payrollData.filter(e => {
      const matchBadge = String(e.badge_number || '').toLowerCase().includes(searchBadge.toLowerCase());
      const matchName = String(e.name || '').toLowerCase().includes(searchName.toLowerCase());
      const matchTrade = selectedTrade === 'All Trades' || e.Trade === selectedTrade;
      const matchDivision = selectedDivision === 'All Divisions' || e.division === selectedDivision;
      const matchSite = selectedSite === 'All Sites' || e.site === selectedSite;
      const matchStatus = selectedStatus === 'All Statuses' || e.Empoyment_status === selectedStatus;
      return matchBadge && matchName && matchTrade && matchDivision && matchSite && matchStatus;
    });
  }, [payrollData, searchBadge, searchName, selectedTrade, selectedDivision, selectedSite, selectedStatus]);

  const filteredReportRecords = useMemo(() => {
    return reportRecords.filter(r => {
      const matchBadge = reportSelectedBadge === 'All' || String(r.badge_number) === reportSelectedBadge;
      const matchSite = reportSelectedSite === 'All Sites' || r.site === reportSelectedSite;
      const matchDivision = reportSelectedDivision === 'All Divisions' || r.division === reportSelectedDivision;
      const matchAttendance = reportSelectedAttendance === 'All' || r.attendance_status === reportSelectedAttendance;
      return matchBadge && matchSite && matchDivision && matchAttendance;
    });
  }, [reportRecords, reportSelectedBadge, reportSelectedSite, reportSelectedDivision, reportSelectedAttendance]);

  const reportStats = useMemo(() => {
    const totalDays = filteredReportRecords.length;
    const presentCount = filteredReportRecords.filter(r => r.attendance_status === 'Present').length;
    const absentCount = filteredReportRecords.filter(r => r.attendance_status === 'Absent').length;
    const totalOT = filteredReportRecords.reduce((acc, r) => acc + (r.overtime_hours || 0), 0);
    return { totalDays, presentCount, absentCount, totalOT };
  }, [filteredReportRecords]);

  // Dynamic Theme Class Tokens
  const themeTokens = {
    bgMain: isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900',
    header: isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200',
    card: isDarkMode ? 'bg-slate-900 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm',
    cardSub: isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200',
    input: isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    tableHead: isDarkMode ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200',
    tableRowHover: isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50',
    tableBorder: isDarkMode ? 'border-slate-800' : 'border-slate-200',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-500',
  };

  if (isLoading) return <div className={`p-10 text-center font-bold min-h-screen flex items-center justify-center ${themeTokens.bgMain}`}>Loading Manpower OS...</div>;

  if (!authRole) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${themeTokens.bgMain}`}>
        <div className={`p-8 rounded-2xl shadow-2xl w-full max-w-md border ${themeTokens.card}`}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tighter">Manpower OS</h1>
            <p className={`mt-2 text-sm ${themeTokens.textMuted}`}>Secure Portal Login</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email Address"
                className={`w-full border p-4 rounded-xl text-center text-base focus:border-blue-500 outline-none mb-3 ${themeTokens.input}`}
                required
              />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password"
                className={`w-full border p-4 rounded-xl text-center text-lg font-mono tracking-widest focus:border-blue-500 outline-none ${themeTokens.input}`}
                required
              />
            </div>
            {loginError && <p className="text-rose-500 text-sm font-bold text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-md transition">
              Secure Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-6 font-sans transition-colors duration-200 ${themeTokens.bgMain}`}>
      <div className="max-w-[1500px] mx-auto">
        <header className={`mb-6 border-b pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4`}>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Manpower OS</h1>
              {/* 🌗 Mobile & Desktop Theme Mode Toggle Button */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shadow-sm ${
                  isDarkMode 
                    ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700' 
                    : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                }`}
                title="Toggle Light/Dark Theme"
              >
                {isDarkMode ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 md:gap-3 mt-4">
              <button 
                onClick={() => setActiveTab('daily')} 
                className={`px-4 md:px-5 py-2.5 rounded-xl font-bold transition text-xs md:text-sm ${
                  activeTab === 'daily' ? 'bg-blue-600 text-white shadow-md' : `${themeTokens.card} ${themeTokens.textMuted} hover:opacity-80`
                }`}
              >
                ⏱️ Daily Tracker
              </button>
              {authRole === 'admin' && (
                <>
                  <button 
                    onClick={() => setActiveTab('payroll')} 
                    className={`px-4 md:px-5 py-2.5 rounded-xl font-bold transition text-xs md:text-sm ${
                      activeTab === 'payroll' ? 'bg-blue-600 text-white shadow-md' : `${themeTokens.card} ${themeTokens.textMuted} hover:opacity-80`
                    }`}
                  >
                    💵 Payroll
                  </button>
                  <button 
                    onClick={() => setActiveTab('reports')} 
                    className={`px-4 md:px-5 py-2.5 rounded-xl font-bold transition text-xs md:text-sm ${
                      activeTab === 'reports' ? 'bg-emerald-600 text-white shadow-md' : `${themeTokens.card} ${themeTokens.textMuted} hover:opacity-80`
                    }`}
                  >
                    📊 Reports
                  </button>
                  <button 
                    onClick={() => setActiveTab('settings')} 
                    className={`px-4 md:px-5 py-2.5 rounded-xl font-bold transition text-xs md:text-sm ${
                      activeTab === 'settings' ? 'bg-purple-600 text-white shadow-md' : `${themeTokens.card} ${themeTokens.textMuted} hover:opacity-80`
                    }`}
                  >
                    ⚙️ Settings
                  </button>
                  
                  <Link 
                    href="/hr" 
                    className="px-4 md:px-5 py-2.5 rounded-xl font-bold transition text-xs md:text-sm border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center gap-2 shadow-sm"
                  >
                    🏢 HR Hub Dashboard
                  </Link>
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold uppercase ${themeTokens.textMuted}`}>
                Role: <span className={authRole === 'admin' ? 'text-blue-400 font-black' : 'text-emerald-400 font-black'}>{authRole}</span>
              </span>
              <button 
                onClick={handleLogout} 
                className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-lg font-bold text-xs hover:bg-rose-500/20 transition"
              >
                Log Out
              </button>
            </div>
            <div className={`text-[10px] font-mono ${themeTokens.textMuted}`}>GPS: {geoCoords}</div>
          </div>
        </header>

        {/* --- SYSTEM SETTINGS TAB (ADMIN ONLY) --- */}
        {activeTab === 'settings' && authRole === 'admin' && (
          <div className={`rounded-2xl border p-4 md:p-8 space-y-8 ${themeTokens.card}`}>
            <h2 className="text-2xl font-black">Company Settings</h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className={`p-6 rounded-2xl border flex flex-col justify-between ${themeTokens.cardSub}`}>
                <div>
                  <h3 className="font-bold text-lg mb-4 text-blue-400">➕ Register New Employee</h3>
                  <form onSubmit={handleAddEmployee} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Badge #</label>
                      <input type="number" value={newEmpForm.badge_number} onChange={e => setNewEmpForm({...newEmpForm, badge_number: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs font-mono ${themeTokens.input}`} placeholder="e.g. 999" required />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Full Name</label>
                      <input type="text" value={newEmpForm.name} onChange={e => setNewEmpForm({...newEmpForm, name: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`} placeholder="John Doe" required />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Trade</label>
                      <input type="text" value={newEmpForm.Trade} onChange={e => setNewEmpForm({...newEmpForm, Trade: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`} placeholder="e.g. Plumber" />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Division</label>
                      <select value={newEmpForm.division} onChange={e => setNewEmpForm({...newEmpForm, division: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`}>
                        <option value="">Select Division...</option>
                        {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Site</label>
                      <select value={newEmpForm.site} onChange={e => setNewEmpForm({...newEmpForm, site: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`}>
                        <option value="">Select Site...</option>
                        {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </form>
                </div>
                <div className="mt-6">
                  <button onClick={handleAddEmployee} disabled={isAddingEmp} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-md text-xs">
                    {isAddingEmp ? 'Registering...' : 'Save Employee to Database'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className={`p-6 rounded-2xl border flex flex-col items-center ${themeTokens.cardSub}`}>
                  <h3 className="font-bold text-lg mb-4 text-emerald-400 self-start">👤 Biometric Face ID Setup</h3>
                  <div className="w-full max-w-md">
                     <FaceRegistration employees={employees} />
                  </div>
                </div>

                {/* 📂 MATRIX EXPORT & IMPORT SECTION */}
                <div className={`p-6 rounded-2xl border flex flex-col justify-between ${themeTokens.cardSub}`}>
                  <div>
                    <h3 className="font-bold text-lg mb-2 text-amber-400">📂 Matrix Timesheet Management</h3>
                    <p className={`text-xs mb-4 ${themeTokens.textMuted}`}>
                      Export or import monthly matrix timesheets featuring daily absents, presents, and overtime records.
                    </p>
                    
                    <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Target Month</label>
                    <input 
                      type="month" 
                      value={importMonth} 
                      onChange={(e) => setImportMonth(e.target.value)} 
                      className={`w-full mb-4 p-2.5 border rounded-xl text-xs font-bold ${themeTokens.input}`} 
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => handleExportMatrixTimesheet(importMonth, true)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold py-3 rounded-xl transition shadow-md text-xs flex items-center justify-center gap-1.5"
                      title="Download blank matrix template pre-filled with employee roster"
                    >
                      <span>📥 Matrix Template (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => handleExportMatrixTimesheet(importMonth, false)}
                      className="flex-1 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 text-blue-300 font-bold py-3 rounded-xl transition shadow-md text-xs flex items-center justify-center gap-1.5"
                      title="Export current month attendance and overtime matrix data"
                    >
                      <span>💾 Export Matrix (.xlsx)</span>
                    </button>

                    <label className={`flex-1 text-center bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition shadow-md cursor-pointer text-xs flex items-center justify-center gap-1.5 ${isImportingCSV ? 'opacity-50 cursor-wait' : ''}`}>
                      <span>{isImportingCSV ? 'Importing...' : '📁 Import Matrix (.xlsx)'}</span>
                      <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} disabled={isImportingCSV} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={`p-6 rounded-2xl border ${themeTokens.cardSub}`}>
                <h3 className="font-bold text-lg mb-4">Manage Sites</h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" value={newSiteInput} onChange={(e) => setNewSiteInput(e.target.value)} placeholder="New Site Name..." className={`flex-1 min-w-0 border p-2.5 rounded-xl text-xs ${themeTokens.input}`} />
                  <button onClick={handleAddSite} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap">Add</button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {dbSites.map(site => (
                    <div key={site} className={`flex justify-between items-center p-3 rounded-xl border shadow-sm ${themeTokens.card}`}>
                      <span className="font-bold text-xs truncate mr-2">{site}</span>
                      <button onClick={() => handleDeleteSite(site)} className="text-rose-400 hover:text-rose-300 font-bold text-[10px] bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">Delete</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${themeTokens.cardSub}`}>
                <h3 className="font-bold text-lg mb-4">Manage Divisions</h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" value={newDivisionInput} onChange={(e) => setNewDivisionInput(e.target.value)} placeholder="New Division Name..." className={`flex-1 min-w-0 border p-2.5 rounded-xl text-xs ${themeTokens.input}`} />
                  <button onClick={handleAddDivision} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap">Add</button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {dbDivisions.map(div => (
                    <div key={div} className={`flex justify-between items-center p-3 rounded-xl border shadow-sm ${themeTokens.card}`}>
                      <span className="font-bold text-xs truncate mr-2">{div}</span>
                      <button onClick={() => handleDeleteDivision(div)} className="text-rose-400 hover:text-rose-300 font-bold text-[10px] bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- REPORTS TAB (ADMIN ONLY) --- */}
        {activeTab === 'reports' && authRole === 'admin' && (
          <div className={`rounded-2xl border p-4 md:p-8 space-y-6 ${themeTokens.card}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Attendance Analytics & Reports</h2>
                <p className={`text-xs mt-1 ${themeTokens.textMuted}`}>Generate filtered attendance logs by date range, individual employee, site, department, and status.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => handleExportMatrixTimesheet(reportStartDate.slice(0, 7), false)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-3 rounded-xl shadow transition whitespace-nowrap"
                >
                  📊 Export Matrix Timesheet (.xlsx)
                </button>
                <button 
                  onClick={exportReportCSV}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-3 rounded-xl shadow transition whitespace-nowrap"
                >
                  📥 Export Report CSV
                </button>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 ${themeTokens.cardSub}`}>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Start Date</label>
                <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`} />
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1 ${themeTokens.textMuted}`}>End Date</label>
                <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`} />
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Individual Employee</label>
                <select value={reportSelectedBadge} onChange={(e) => setReportSelectedBadge(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.badge_number} value={String(emp.badge_number)}>
                      #{emp.badge_number} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Site Filter</label>
                <select value={reportSelectedSite} onChange={(e) => setReportSelectedSite(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Sites">All Sites</option>
                  {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Department / Division</label>
                <select value={reportSelectedDivision} onChange={(e) => setReportSelectedDivision(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Divisions">All Divisions</option>
                  {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Attendance Status</label>
                <select value={reportSelectedAttendance} onChange={(e) => setReportSelectedAttendance(e.target.value)} className={`w-full text-xs border rounded-xl p-2 font-bold text-emerald-400 ${themeTokens.input}`}>
                  <option value="All">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Leave">Leave</option>
                  <option value="Week Off">Week Off</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Total Logs Found</span>
                <span className="text-2xl font-black text-blue-300">{reportStats.totalDays}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-emerald-400 uppercase mb-1">Present Days</span>
                <span className="text-2xl font-black text-emerald-300">{reportStats.presentCount}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-rose-400 uppercase mb-1">Absent Days</span>
                <span className="text-2xl font-black text-rose-300">{reportStats.absentCount}</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-purple-400 uppercase mb-1">Total Overtime</span>
                <span className="text-2xl font-black text-purple-300">{reportStats.totalOT}h</span>
              </div>
            </div>

            {isReportLoading ? (
              <div className={`p-12 text-center font-bold ${themeTokens.textMuted}`}>Generating analytics report...</div>
            ) : filteredReportRecords.length === 0 ? (
              <div className={`p-12 text-center border border-dashed rounded-2xl ${themeTokens.textMuted}`}>
                No attendance logs found matching this criteria for the selected date range.
              </div>
            ) : (
              <div className={`overflow-x-auto border rounded-2xl ${themeTokens.tableBorder}`}>
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className={`border-b text-[10px] font-bold uppercase ${themeTokens.tableHead}`}>
                      <th className="p-3.5 text-center">Date</th>
                      <th className="p-3.5 text-center">Badge</th>
                      <th className="p-3.5">Employee Name</th>
                      <th className="p-3.5 text-center">Department</th>
                      <th className="p-3.5 text-center">Site</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-center">Clock In</th>
                      <th className="p-3.5 text-center">Clock Out</th>
                      <th className="p-3.5 text-center">Overtime</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs ${themeTokens.tableBorder}`}>
                    {filteredReportRecords.map((r, idx) => (
                      <tr key={idx} className={`font-medium ${themeTokens.tableRowHover}`}>
                        <td className="p-3.5 text-center font-mono font-bold text-blue-400">{r.date}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-blue-400">#{r.badge_number}</td>
                        <td className="p-3.5 font-bold">{r.name}</td>
                        <td className="p-3.5 text-center">{r.division || '-'}</td>
                        <td className="p-3.5 text-center">{r.site}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] 
                            ${r.attendance_status === 'Present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                              r.attendance_status === 'Absent' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                              r.attendance_status === 'Sick' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                              r.attendance_status === 'Week Off' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                            {r.attendance_status}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono">{r.clock_in || '-'}</td>
                        <td className="p-3.5 text-center font-mono">{r.clock_out || '-'}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-blue-400">{r.overtime_hours ? `${r.overtime_hours}h` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MAIN TRACKER TAB */}
        {activeTab === 'daily' && (
          <div className={`rounded-2xl border p-4 md:p-6 space-y-6 ${themeTokens.card}`}>
            <div className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
              <div className="flex flex-col md:flex-row gap-4 md:items-end w-full md:w-auto">
                <div className="w-full md:w-auto">
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${themeTokens.textMuted}`}>Tracking Date</label>
                  <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className={`w-full md:w-auto border rounded-xl p-2.5 text-xs font-bold ${themeTokens.input}`}/>
                </div>

                <div className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl font-bold text-xs shadow-inner ${themeTokens.cardSub}`}>
                  {isSavingAttendance ? (
                    <><span className="animate-pulse">🔄</span> Syncing to Cloud...</>
                  ) : lastSyncTime ? (
                    <><span className="text-emerald-400">☁️</span> Synced at {lastSyncTime}</>
                  ) : (
                    <><span className="text-emerald-400">☁️</span> Cloud Active</>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setShowMissingPunches(!showMissingPunches)} 
                  className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition ${
                    showMissingPunches ? 'bg-amber-500 text-white border border-amber-600' 
                    : missingPunchesCount > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20' 
                    : 'opacity-50 cursor-not-allowed border border-slate-700'
                  }`}
                  disabled={missingPunchesCount === 0 && !showMissingPunches}
                >
                  {showMissingPunches ? 'List All Workers' : `⚠️ ${missingPunchesCount} Missing Punch${missingPunchesCount !== 1 ? 'es' : ''}`}
                </button>

                <button onClick={() => handleExportMatrixTimesheet(currentDate.slice(0, 7), false)} className={`w-full md:w-auto border px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm ${themeTokens.card} hover:opacity-80`}>
                  📊 Export Matrix Sheet (.xlsx)
                </button>

                <button onClick={exportDaily} className={`w-full md:w-auto border px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm ${themeTokens.card} hover:opacity-80`}>
                  Export Daily CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`p-5 border rounded-2xl flex flex-col items-center shadow-inner ${themeTokens.cardSub}`}>
                <h3 className="mt-0 mb-4 font-black text-base text-center">Live AI Scanner</h3>
                <FaceDetector 
                  employees={employees}
                  onRecognize={(badgeNumber) => {
                    const emp = employees.find((e: any) => String(e.badge_number) === badgeNumber);
                    if (!emp) return;

                    const now = new Date();
                    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const exactTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    setHasUnsavedChanges(true); 

                    setAttendance(prevAtt => {
                      if (prevAtt[badgeNumber] === 'Present') {
                        setClockIn(prevIn => {
                          const inTime = prevIn[badgeNumber];
                          if (inTime) {
                            const [inHours, inMinutes] = inTime.split(':').map(Number);
                            const inDate = new Date();
                            inDate.setHours(inHours, inMinutes, 0, 0);

                            const diffHours = (now.getTime() - inDate.getTime()) / (1000 * 60 * 60);

                            if (diffHours >= 5) {
                              setClockOut(prevOut => {
                                if (!prevOut[badgeNumber]) {
                                  setActivityLogs(logs => [{ id: Math.random().toString(), time: exactTime, message: `Clocked Out: ${emp.name}`, type: 'out' }, ...logs]);
                                  return { ...prevOut, [badgeNumber]: timeString };
                                }
                                return prevOut;
                              });
                            }
                          }
                          return prevIn;
                        });
                        return prevAtt; 
                      }

                      setClockIn(c => ({...c, [badgeNumber]: timeString}));
                      setActivityLogs(logs => [{ id: Math.random().toString(), time: exactTime, message: `Clocked In: ${emp.name}`, type: 'in' }, ...logs]);
                      
                      return {...prevAtt, [badgeNumber]: 'Present'};
                    });
                  }} 
                />
              </div>

              <div className={`p-5 border rounded-2xl shadow-sm flex flex-col h-full min-h-[400px] ${themeTokens.card}`}>
                <h3 className="mt-0 mb-4 font-black text-base text-center">Activity Log</h3>
                <div className={`flex-1 overflow-y-auto max-h-[350px] lg:max-h-[500px] border rounded-xl p-3 space-y-2 ${themeTokens.cardSub}`}>
                  {activityLogs.length === 0 ? (
                    <div className={`h-full flex flex-col items-center justify-center ${themeTokens.textMuted}`}>
                      <span className="text-3xl mb-2">📋</span>
                      <span className="font-bold text-xs">Waiting for scans...</span>
                    </div>
                  ) : (
                    activityLogs.map(log => (
                      <div key={log.id} className={`p-3 rounded-xl border text-xs flex justify-between items-center shadow-sm ${
                        log.type === 'in' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      }`}>
                        <span className="font-bold flex items-center gap-2">
                          {log.type === 'in' ? '🟢' : '🔵'} {log.message}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-1 rounded-md border opacity-80 whitespace-nowrap ${themeTokens.card}`}>
                          {log.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border ${themeTokens.cardSub}`}>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                <input type="text" value={searchBadge} onChange={e => setSearchBadge(e.target.value)} placeholder="Badge..." className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`} />
                <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Name..." className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`} />
                <select value={selectedTrade} onChange={(e) => setSelectedTrade(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Trades">All Trades</option>
                  {uniqueTrades.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Divisions">All Divisions</option>
                  {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Sites">All Sites</option>
                  {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Statuses">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedAttendance} onChange={(e) => setSelectedAttendance(e.target.value)} className={`w-full text-xs border rounded-xl p-2 font-bold ${themeTokens.input}`}>
                  <option value="All">All Attendance</option>
                  <option value="Unmarked">Unmarked</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Leave">Leave</option>
                  <option value="Week Off">Week Off</option>
                </select>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {filtered.map(e => {
                const isLocked = e.Empoyment_status === 'Resigned' || (e.Empoyment_status === 'Notice Period' && !!e.status_date && currentDate > e.status_date);
                const attState = attendance[e.badge_number] || '';
                
                let attClass = 'bg-slate-800 text-slate-400 border-slate-700';
                if (attState === 'Present') attClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
                else if (attState === 'Absent') attClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
                else if (attState === 'Sick') attClass = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
                else if (attState === 'Leave') attClass = 'bg-purple-500/20 text-purple-400 border-purple-500/40';
                else if (attState === 'Week Off') attClass = 'bg-sky-500/20 text-sky-400 border-sky-500/40';

                return (
                  <div key={e.badge_number} className={`border rounded-2xl shadow-sm overflow-hidden ${themeTokens.card} ${isLocked ? 'border-rose-500/40' : ''} ${showMissingPunches ? 'border-amber-400 bg-amber-500/10' : ''}`}>
                    <div className={`p-3.5 border-b flex justify-between items-start ${showMissingPunches ? 'bg-amber-500/20' : themeTokens.cardSub}`}>
                      <div>
                        <h3 className={`font-bold text-sm ${isLocked ? 'text-slate-500 line-through' : ''}`}>{e.name}</h3>
                        <span className="font-mono text-xs font-bold text-blue-400 mt-0.5 block">#{e.badge_number}</span>
                      </div>
                      
                      <div className="flex flex-col gap-1 items-end">
                        <button onClick={() => { setEditingEmployee(e); setEditForm({site: e.site, Empoyment_status: e.Empoyment_status, status_date: e.status_date, division: e.division || ''}); }} className={`font-bold text-[10px] px-2.5 py-1 rounded-lg border ${themeTokens.cardSub}`}>
                          Edit Site
                        </button>
                        <Link href={`/hr/employees/${e.badge_number}`} className="text-blue-400 font-bold text-[10px] bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/30">
                          HR Profile
                        </Link>
                      </div>
                    </div>

                    <div className="p-3.5 grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                      <div><span className={`block font-bold uppercase text-[10px] ${themeTokens.textMuted}`}>Site</span><span className="font-medium">{e.site}</span></div>
                      <div><span className={`block font-bold uppercase text-[10px] ${themeTokens.textMuted}`}>Status</span><span className={`font-bold ${isLocked ? 'text-rose-400' : ''}`}>{e.Empoyment_status}</span></div>
                    </div>

                    <div className={`px-3.5 py-3 border-t flex flex-col gap-3 ${showMissingPunches ? 'bg-amber-500/10' : themeTokens.cardSub}`}>
                        <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-bold uppercase ${themeTokens.textMuted}`}>Attendance</span>
                            <select 
                                value={attState}
                                onChange={(ev) => handleAttendanceChange(e.badge_number, ev.target.value)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold w-32 border outline-none cursor-pointer ${attClass}`}
                                disabled={isLocked}
                            >
                                <option value="">Unmarked</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Sick">Sick</option>
                                <option value="Leave">Leave</option>
                                <option value="Week Off">Week Off</option>
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${themeTokens.textMuted}`}>Clock In</span>
                                <input type="time" value={clockIn[e.badge_number] || ''} onChange={(ev) => { setClockIn(p => ({...p, [e.badge_number]: ev.target.value})); setHasUnsavedChanges(true); }} className={`w-full text-xs p-1.5 border rounded-xl font-mono ${themeTokens.input}`} disabled={attState !== 'Present'} />
                            </div>
                            <div>
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${showMissingPunches ? 'text-amber-400' : themeTokens.textMuted}`}>Clock Out</span>
                                <input type="time" value={clockOut[e.badge_number] || ''} onChange={(ev) => { setClockOut(p => ({...p, [e.badge_number]: ev.target.value})); setHasUnsavedChanges(true); }} className={`w-full text-xs p-1.5 border rounded-xl font-mono ${themeTokens.input} ${showMissingPunches ? 'border-amber-400' : ''}`} disabled={attState !== 'Present'} />
                            </div>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Desktop Table */}
            <div className={`hidden md:block overflow-x-auto border rounded-2xl ${themeTokens.tableBorder}`}>
              <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead><tr className={`border-b text-[10px] font-bold uppercase ${themeTokens.tableHead}`}>
                  <th className="p-3.5 text-center">Badge</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5 text-center">Trade</th>
                  <th className="p-3.5 text-center">Division</th>
                  <th className="p-3.5 text-center">Site</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Manage</th>
                  <th className="p-3.5 text-center">Attendance</th>
                  <th className="p-3.5 text-center">Clock In</th>
                  <th className="p-3.5 text-center">Clock Out</th>
                  <th className="p-3.5 text-center">Overtime</th>
                </tr></thead>
                <tbody className={`divide-y text-xs ${themeTokens.tableBorder}`}>
                  {filtered.map(e => {
                    const isLocked = e.Empoyment_status === 'Resigned' || (e.Empoyment_status === 'Notice Period' && !!e.status_date && currentDate > e.status_date);
                    const attState = attendance[e.badge_number] || '';
                    
                    let attClass = 'bg-slate-800 text-slate-400 border-slate-700';
                    if (attState === 'Present') attClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
                    else if (attState === 'Absent') attClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
                    else if (attState === 'Sick') attClass = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
                    else if (attState === 'Leave') attClass = 'bg-purple-500/20 text-purple-400 border-purple-500/40';
                    else if (attState === 'Week Off') attClass = 'bg-sky-500/20 text-sky-400 border-sky-500/40';

                    return (
                      <tr key={e.badge_number} className={`${themeTokens.tableRowHover} ${showMissingPunches ? 'bg-amber-500/10' : ''}`}>
                        <td className="p-3.5 text-center font-mono font-bold text-blue-400">#{e.badge_number}</td>
                        <td className={`p-3.5 font-bold ${isLocked ? 'text-slate-500 line-through' : ''}`}>{e.name}</td>
                        <td className={`p-3.5 text-center ${themeTokens.textMuted}`}>{e.Trade}</td>
                        <td className={`p-3.5 text-center ${themeTokens.textMuted}`}>{e.division || '-'}</td>
                        <td className={`p-3.5 text-center ${themeTokens.textMuted}`}>{e.site}</td>
                        <td className={`p-3.5 text-center font-bold ${isLocked ? 'text-rose-400' : ''}`}>{e.Empoyment_status}</td>
                        
                        <td className="p-3.5 text-center flex items-center justify-center gap-2">
                            <button onClick={() => { setEditingEmployee(e); setEditForm({site: e.site, Empoyment_status: e.Empoyment_status, status_date: e.status_date, division: e.division || ''}); }} className="hover:underline font-bold">Edit</button>
                            <span className="opacity-30">|</span>
                            <Link href={`/hr/employees/${e.badge_number}`} className="text-blue-400 hover:underline font-bold">
                              HR Profile
                            </Link>
                        </td>

                        <td className="p-3.5 text-center">
                          <select 
                             value={attState}
                             onChange={(ev) => handleAttendanceChange(e.badge_number, ev.target.value)}
                             className={`px-3 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer text-center w-32 ${attClass}`}
                             disabled={isLocked}
                          >
                             <option value="">Unmarked</option>
                             <option value="Present">Present</option>
                             <option value="Absent">Absent</option>
                             <option value="Sick">Sick Leave</option>
                             <option value="Leave">Leave</option>
                             <option value="Week Off">Week Off</option>
                          </select>
                        </td>
                        <td className="p-3.5 text-center">
                          <input type="time" value={clockIn[e.badge_number] || ''} onChange={(ev) => { setClockIn(p => ({...p, [e.badge_number]: ev.target.value})); setHasUnsavedChanges(true); }} className={`p-1 border rounded-lg text-xs font-mono ${themeTokens.input}`} disabled={attState !== 'Present'} />
                        </td>
                        <td className="p-3.5 text-center">
                          <input type="time" value={clockOut[e.badge_number] || ''} onChange={(ev) => { setClockOut(p => ({...p, [e.badge_number]: ev.target.value})); setHasUnsavedChanges(true); }} className={`p-1 border rounded-lg text-xs font-mono ${themeTokens.input} ${showMissingPunches ? 'border-amber-400' : ''}`} disabled={attState !== 'Present'} />
                        </td>
                        <td className="p-3.5 text-center">
                          <input type="number" min="0" max="12" value={overtime[e.badge_number] || 0} onChange={(ev) => { setOvertime(p => ({...p, [e.badge_number]: Number(ev.target.value)})); setHasUnsavedChanges(true); }} className={`w-16 border rounded-lg p-1 text-center font-mono font-bold text-xs ${themeTokens.input}`} disabled={attState !== 'Present'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- PAYROLL TAB (ADMIN ONLY) --- */}
        {activeTab === 'payroll' && authRole === 'admin' && (
          <div className={`rounded-2xl border p-4 md:p-6 space-y-6 ${themeTokens.card}`}>
             <div className="flex flex-col md:flex-row gap-4 md:justify-between items-center">
              <input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} className={`border p-2.5 rounded-xl font-bold text-xs w-full md:w-auto ${themeTokens.input}`} />
              
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button onClick={() => handleExportMatrixTimesheet(payrollMonth, false)} className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-5 py-2.5 rounded-xl font-bold text-xs transition">
                  📊 Export Matrix Timesheet (.xlsx)
                </button>
                <button onClick={exportPayroll} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition">
                  Export Payroll CSV
                </button>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border ${themeTokens.cardSub}`}>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <input type="text" value={searchBadge} onChange={e => setSearchBadge(e.target.value)} placeholder="Badge..." className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`} />
                <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Name..." className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`} />
                <select value={selectedTrade} onChange={(e) => setSelectedTrade(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Trades">All Trades</option>
                  {uniqueTrades.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Divisions">All Divisions</option>
                  {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Sites">All Sites</option>
                  {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={`w-full text-xs border rounded-xl p-2 ${themeTokens.input}`}>
                  <option value="All Statuses">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {isPayrollLoading ? <div className={`p-10 text-center font-bold ${themeTokens.textMuted}`}>Calculating Payroll...</div> : (
              <>
                {/* Mobile Payroll Cards */}
                <div className="block md:hidden space-y-4">
                  {filteredPayroll.map(e => {
                    const isLocked = e.Empoyment_status === 'Resigned' || (e.Empoyment_status === 'Notice Period' && !!e.status_date && currentDate > e.status_date);
                    return (
                      <div key={e.badge_number} className={`border rounded-2xl shadow-sm overflow-hidden ${themeTokens.card} ${isLocked ? 'border-rose-500/40' : ''}`}>
                        <div className={`p-3.5 border-b flex justify-between items-start ${themeTokens.cardSub}`}>
                          <div>
                            <h3 className={`font-bold text-sm ${isLocked ? 'text-slate-500 line-through' : ''}`}>{e.name}</h3>
                            <span className="font-mono text-xs font-bold text-blue-400 mt-0.5 block">#{e.badge_number}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {e.Empoyment_status}
                          </span>
                        </div>

                        <div className="p-3.5 grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                          <div><span className={`block font-bold uppercase text-[10px] ${themeTokens.textMuted}`}>Site</span><span className="font-medium">{e.site}</span></div>
                          <div><span className={`block font-bold uppercase text-[10px] ${themeTokens.textMuted}`}>Trade</span><span className="font-medium">{e.Trade}</span></div>
                        </div>

                        <div className={`px-3.5 py-3 border-t grid grid-cols-3 gap-2 text-center text-xs ${themeTokens.cardSub}`}>
                          <div className={`p-1.5 rounded-xl border ${themeTokens.card}`}>
                            <span className={`block font-bold text-[9px] uppercase ${themeTokens.textMuted}`}>Present</span>
                            <span className="font-bold text-sm">{e.totalPresent || 0}</span>
                          </div>
                          <div className={`p-1.5 rounded-xl border ${themeTokens.card}`}>
                            <span className="block font-bold text-sky-400 text-[9px] uppercase">Week Off</span>
                            <span className="font-bold text-sky-400 text-sm">{e.weekOff || 0}</span>
                          </div>
                          <div className={`p-1.5 rounded-xl border ${themeTokens.card}`}>
                            <span className="block font-bold text-amber-400 text-[9px] uppercase">Sick</span>
                            <span className="font-bold text-amber-400 text-sm">{e.sick || 0}</span>
                          </div>
                          <div className={`p-1.5 rounded-xl border ${themeTokens.card}`}>
                            <span className="block font-bold text-purple-400 text-[9px] uppercase">Leave</span>
                            <span className="font-bold text-purple-400 text-sm">{e.leave || 0}</span>
                          </div>
                          <div className="bg-purple-500/20 p-1.5 rounded-xl border border-purple-500/30 shadow-inner">
                            <span className="block font-bold text-purple-300 text-[9px] uppercase">Total Worked</span>
                            <span className="font-black text-purple-200 text-sm">{e.totalWorkedDays || 0}</span>
                          </div>
                          <div className={`p-1.5 rounded-xl border ${themeTokens.card}`}>
                            <span className={`block font-bold text-[9px] uppercase ${themeTokens.textMuted}`}>Absent</span>
                            <span className="font-bold text-rose-400 text-sm">{e.totalAbsent || 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Payroll Table */}
                <div className={`hidden md:block overflow-x-auto border rounded-2xl ${themeTokens.tableBorder}`}>
                    <table className="w-full text-left border-collapse min-w-[1250px]">
                      <thead>
                          <tr className={`border-b text-[10px] font-bold uppercase ${themeTokens.tableHead}`}>
                              <th className="p-4 text-center">Badge</th>
                              <th className="p-4">Name</th>
                              <th className="p-4 text-center">Trade</th>
                              <th className="p-4 text-center">Site</th>
                              <th className="p-4 text-center">Status</th>
                              <th className="p-4 text-center">Present</th>
                              <th className="p-4 text-center text-sky-400 bg-sky-500/10">Week Off</th>
                              <th className="p-4 text-center text-amber-400 bg-amber-500/10">Sick</th>
                              <th className="p-4 text-center text-purple-400 bg-purple-500/10">Leave</th>
                              <th className="p-4 text-center text-purple-300 bg-purple-500/20">Total Worked Days</th>
                              <th className="p-4 text-center">Absent</th>
                              <th className="p-4 text-center">Overtime</th>
                          </tr>
                      </thead>
                      <tbody className={`divide-y text-xs font-medium ${themeTokens.tableBorder}`}>
                        {filteredPayroll.map(e => {
                          const isLocked = e.Empoyment_status === 'Resigned' || (e.Empoyment_status === 'Notice Period' && !!e.status_date && currentDate > e.status_date);
                          return (
                            <tr key={e.badge_number} className={themeTokens.tableRowHover}>
                              <td className="p-4 text-center font-mono font-bold text-blue-400">#{e.badge_number}</td>
                              <td className={`p-4 font-bold ${isLocked ? 'text-slate-500 line-through' : ''}`}>{e.name}</td>
                              <td className={`p-4 text-center ${themeTokens.textMuted}`}>{e.Trade}</td>
                              <td className={`p-4 text-center ${themeTokens.textMuted}`}>{e.site}</td>
                              <td className={`p-4 text-center font-bold ${isLocked ? 'text-rose-400' : ''}`}>{e.Empoyment_status}</td>
                              
                              <td className="p-4 text-center font-bold">{e.totalPresent || 0}</td>
                              <td className="p-4 text-center font-bold text-sky-400 bg-sky-500/10">{e.weekOff || 0}</td>
                              <td className="p-4 text-center font-bold text-amber-400 bg-amber-500/10">{e.sick || 0}</td>
                              <td className="p-4 text-center font-bold text-purple-400 bg-purple-500/10">{e.leave || 0}</td>
                              <td className="p-4 text-center font-black text-base text-purple-300 bg-purple-500/20 shadow-inner">{e.totalWorkedDays || 0}</td>
                              <td className="p-4 text-center font-bold text-rose-400">{e.totalAbsent || 0}</td>
                              
                              <td className="p-4 text-center font-mono font-bold text-amber-400">{e.totalOvertime || 0}h</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* --- EDIT MODAL --- */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl space-y-4 border ${themeTokens.card}`}>
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-black">Edit Profile</h2>
            </div>
            <div className={`text-xs font-bold p-2.5 rounded-xl border ${themeTokens.cardSub}`}>
              Badge: #{editingEmployee.badge_number} | {editingEmployee.name}
            </div>

            <div className="space-y-4">
              <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Division</label>
                  <select value={editForm.division} onChange={(e) => setEditForm({...editForm, division: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`}>
                    <option value="">Select Division</option>
                    {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
              <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Site</label>
                  <select value={editForm.site} onChange={(e) => setEditForm({...editForm, site: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`}>
                    <option value="">Select Site</option>
                    {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
              <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Employment Status</label>
                  <select 
                    value={editForm.Empoyment_status} 
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      setEditForm({...editForm, Empoyment_status: newStatus, status_date: newStatus === 'Active' ? '' : editForm.status_date});
                    }} 
                    className={`w-full border p-2.5 rounded-xl text-xs font-bold ${themeTokens.input}`}
                  >
                    <option value="">Select Status</option>
                    {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
              </div>
              {editForm.Empoyment_status !== 'Active' && (
                  <div>
                      <label className={`block text-xs font-bold uppercase mb-1 ${themeTokens.textMuted}`}>Status Date</label>
                      <input type="date" value={editForm.status_date} onChange={(e) => setEditForm({...editForm, status_date: e.target.value})} className={`w-full border p-2.5 rounded-xl text-xs ${themeTokens.input}`} />
                  </div>
              )}
              
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-2">
                  <button onClick={() => setEditingEmployee(null)} className={`flex-1 p-2.5 rounded-xl font-bold text-xs transition border ${themeTokens.cardSub}`}>Cancel</button>
                  <button onClick={saveEmployeeChanges} className="flex-1 p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition">Update</button>
                </div>
                
                {authRole === 'admin' && (
                  <button 
                    onClick={() => handleDeleteEmployee(editingEmployee.badge_number, editingEmployee.name)} 
                    className="w-full mt-2 p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 rounded-xl font-bold text-xs transition"
                  >
                    🗑️ Permanently Remove Employee
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}