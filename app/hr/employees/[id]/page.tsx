"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function EmployeeProfilePage() {
  const params = useParams();
  const badgeId = params.id;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'gratuity' | 'leave' | 'revisions' | 'audit'>('overview');

  // Original Data State (used for diff checking in audit logs)
  const [originalData, setOriginalData] = useState<any>({});

  // Editable Employee Form State
  const [formData, setFormData] = useState<any>({
    badge_number: '',
    name: '',
    trade: '',
    division: '',
    site: '',
    doj: '',
    lwd: '',
    Empoyment_status: 'Active',
    passport_no: '',
    passport_expiry: '',
    uid_no: '',
    visa_no: '',
    visa_expiry: '',
    health_insurance_no: '',
    health_insurance_expiry: '',
    accidental_insurance_no: '',
    accidental_insurance_expiry: '',
    basic_salary: 0,
    accommodation_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    other_allowance: 0,
    code: 2,
  });

  const [increments, setIncrements] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Gratuity State
  const [gratuityReason, setGratuityReason] = useState<'Resignation' | 'Termination'>('Resignation');
  const [customLWD, setCustomLWD] = useState<string>('');

  // Leave Encashment State
  const [unusedLeaveDays, setUnusedLeaveDays] = useState<number>(0);

  // New Increment Form State
  const [newIncDate, setNewIncDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newIncBasic, setNewIncBasic] = useState<number>(0);
  const [newIncReason, setNewIncReason] = useState<string>('');
  const [isSavingInc, setIsSavingInc] = useState(false);

  useEffect(() => {
    if (badgeId) {
      fetchEmployeeData();
    }
  }, [badgeId]);

  async function fetchEmployeeData() {
    setLoading(true);

    try {
      // Fetch Employee Record
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('badge_number', badgeId)
        .maybeSingle();

      if (empData) {
        const loadedData = {
          badge_number: empData.badge_number || '',
          name: empData.name || '',
          trade: empData.Trade || empData.trade || '',
          division: empData.division || '',
          site: empData.site || '',
          doj: empData.doj || '',
          lwd: empData.lwd || '',
          Empoyment_status: (empData.Empoyment_status || 'Active').replace(/['"']/g, '').trim(),
          passport_no: empData.passport_no || '',
          passport_expiry: empData.passport_expiry || '',
          uid_no: empData.uid_no || '',
          visa_no: empData.visa_no || '',
          visa_expiry: empData.visa_expiry || '',
          health_insurance_no: empData.health_insurance_no || '',
          health_insurance_expiry: empData.health_insurance_expiry || '',
          accidental_insurance_no: empData.accidental_insurance_no || '',
          accidental_insurance_expiry: empData.accidental_insurance_expiry || '',
          basic_salary: Number(empData.basic_salary) || 0,
          accommodation_allowance: Number(empData.accommodation_allowance) || 0,
          transport_allowance: Number(empData.transport_allowance) || 0,
          food_allowance: Number(empData.food_allowance) || 0,
          other_allowance: Number(empData.other_allowance) || 0,
          code: empData.code || (empData.employee_type === 'Staff' ? 1 : 2),
        };

        setFormData(loadedData);
        setOriginalData(loadedData); // Save baseline for diff checking

        if (empData.lwd) setCustomLWD(empData.lwd);
        setNewIncBasic(Number(empData.basic_salary) || 0);
      }

      // Fetch Salary Revisions
      const { data: incData } = await supabase
        .from('salary_increments')
        .select('*')
        .eq('badge_number', badgeId)
        .order('effective_date', { ascending: false });

      if (incData) setIncrements(incData);

      // Fetch Profile Audit Logs
      const { data: auditData } = await supabase
        .from('profile_audit_logs')
        .select('*')
        .eq('badge_number', badgeId)
        .order('created_at', { ascending: false });

      if (auditData) setAuditLogs(auditData);

    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Input Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  // SAVE / UPDATE PROFILE & LOG AUDIT TRAIL
  const handleSaveProfile = async () => {
    // 1. Detect Changes (Diff)
    const changes: { field: string; oldVal: string; newVal: string }[] = [];

    Object.keys(formData).forEach((key) => {
      const oldVal = String(originalData[key] ?? '');
      const newVal = String(formData[key] ?? '');

      if (oldVal !== newVal) {
        changes.push({
          field: key,
          oldVal: oldVal || '—',
          newVal: newVal || '—',
        });
      }
    });

    if (changes.length === 0) {
      alert("No changes detected.");
      return;
    }

    // 2. Prompt for Reason
    const changeReason = prompt(
      `Detected ${changes.length} changed field(s).\n\nPlease enter the reason/remarks for this update (e.g. "Visa renewed", "Salary adjusted"):`,
      "Routine Profile Update"
    );

    if (changeReason === null) {
      // User cancelled
      return;
    }

    setIsSaving(true);

    const payload = {
      badge_number: formData.badge_number,
      name: formData.name,
      Trade: formData.trade,
      division: formData.division,
      site: formData.site,
      // Date fields updated to fallback to null to prevent invalid syntax errors
      doj: formData.doj || null,
      lwd: formData.lwd || null,
      Empoyment_status: formData.Empoyment_status,
      passport_no: formData.passport_no,
      passport_expiry: formData.passport_expiry || null,
      uid_no: formData.uid_no,
      visa_no: formData.visa_no,
      visa_expiry: formData.visa_expiry || null,
      health_insurance_no: formData.health_insurance_no,
      health_insurance_expiry: formData.health_insurance_expiry || null,
      accidental_insurance_no: formData.accidental_insurance_no,
      accidental_insurance_expiry: formData.accidental_insurance_expiry || null,
      basic_salary: Number(formData.basic_salary),
      accommodation_allowance: Number(formData.accommodation_allowance),
      transport_allowance: Number(formData.transport_allowance),
      food_allowance: Number(formData.food_allowance),
      other_allowance: Number(formData.other_allowance),
      code: Number(formData.code),
      employee_type: Number(formData.code) === 1 ? 'Staff' : 'Worker',
    };

    // 3. Update Employee Table
    const { error } = await supabase
      .from('employees')
      .upsert(payload, { onConflict: 'badge_number' });

    if (error) {
      alert("❌ Error updating profile: " + error.message);
    } else {
      // 4. Log Changes to profile_audit_logs
      const logEntries = changes.map((c) => ({
        badge_number: String(formData.badge_number),
        updated_by: 'Secretary / Admin',
        field_changed: c.field,
        old_value: c.oldVal,
        new_value: c.newVal,
        reason: changeReason || 'Profile Update',
      }));

      await supabase.from('profile_audit_logs').insert(logEntries);

      alert(`✅ Profile for Employee #${formData.badge_number} updated and logged successfully!`);
      fetchEmployeeData();
    }

    setIsSaving(false);
  };

  // Salary Calculations
  const basic = Number(formData.basic_salary) || 0;
  const accommodation = Number(formData.accommodation_allowance) || 0;
  const transport = Number(formData.transport_allowance) || 0;
  const food = Number(formData.food_allowance) || 0;
  const others = Number(formData.other_allowance) || 0;
  const totalSalary = basic + accommodation + transport + food + others;

  // --- MoHRE GRATUITY CALCULATOR ---
  const calculateGratuity = () => {
    if (!formData.doj) return { years: 0, days: 0, amount: 0, message: "Date of Joining (DOJ) missing." };
    
    const startDate = new Date(formData.doj);
    const endDate = customLWD ? new Date(customLWD) : new Date();

    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime <= 0) return { years: 0, days: 0, amount: 0, message: "Invalid service duration." };

    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const totalYears = totalDays / 365.25;

    if (totalYears < 1) {
      return { years: totalYears.toFixed(2), days: totalDays, amount: 0, message: "Less than 1 year of service (No Gratuity)." };
    }

    const dailyBasic = basic / 30;
    let gratuityDays = 0;

    if (totalYears <= 5) {
      gratuityDays = totalYears * 21;
    } else {
      gratuityDays = (5 * 21) + ((totalYears - 5) * 30);
    }

    let gratuityAmount = gratuityDays * dailyBasic;
    const maxGratuity = basic * 24;
    if (gratuityAmount > maxGratuity) gratuityAmount = maxGratuity;

    return {
      years: totalYears.toFixed(2),
      days: totalDays,
      amount: Math.round(gratuityAmount),
      message: `Calculated for ${totalYears.toFixed(2)} years of service.`
    };
  };

  const gratuityResult = calculateGratuity();

  // --- LEAVE ENCASHMENT CALCULATOR ---
  const dailyTotalSalary = totalSalary / 30;
  const leaveEncashmentAmount = Math.round(unusedLeaveDays * dailyTotalSalary);

  // --- LOG NEW INCREMENT ---
  const handleAddIncrement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInc(true);

    const prevTotal = totalSalary;
    const newBasic = Number(newIncBasic);
    const newTotalCalculated = newBasic + accommodation + transport + food + others;
    const incValue = newTotalCalculated - prevTotal;

    const payload = {
      badge_number: String(badgeId),
      effective_date: newIncDate,
      previous_total: prevTotal,
      new_total: newTotalCalculated,
      increment_amount: incValue,
      reason: newIncReason || 'Performance Review',
    };

    const { error: incErr } = await supabase.from('salary_increments').insert([payload]);

    if (!incErr) {
      await supabase.from('employees').update({ basic_salary: newBasic }).eq('badge_number', badgeId);
      alert("✅ Salary increment recorded successfully!");
      fetchEmployeeData();
    } else {
      alert("Error logging increment: " + incErr.message);
    }

    setIsSavingInc(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-xs font-bold text-slate-500 animate-pulse">Loading Profile Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div>
            <Link href="/hr" className="text-xs font-bold text-blue-600 hover:underline mb-1 inline-block">
              ← Back to HR Directory
            </Link>
            <h1 className="text-2xl font-black text-slate-900">
              {formData.name || 'Manage Profile'} <span className="text-slate-400 font-mono text-lg">(#{formData.badge_number})</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">{formData.trade || 'Worker'} • {formData.site || 'Unassigned Site'} • Division: {formData.division || '-'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
            >
              {isSaving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👤 Edit Profile Details
          </button>
          <button
            onClick={() => setActiveTab('gratuity')}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'gratuity' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇦🇪 MoHRE Gratuity Calculator
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'leave' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🌴 Leave & Encashment
          </button>
          <button
            onClick={() => setActiveTab('revisions')}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'revisions' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📈 Salary Revision Log
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'audit' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛡️ Audit / Change History
          </button>
        </div>

        {/* TAB 1: EDITABLE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">

            {/* Employment Details */}
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Basic & Employment Details</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white font-bold" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Badge Number</label>
                  <input type="text" name="badge_number" value={formData.badge_number} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-100 font-mono font-bold" readOnly />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Category Code</label>
                  <select name="code" value={formData.code} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white font-semibold">
                    <option value={2}>Code 2 (Worker)</option>
                    <option value={1}>Code 1 (Staff)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Employment Status</label>
                  <select name="Empoyment_status" value={formData.Empoyment_status} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white font-bold">
                    <option value="Active">Active</option>
                    <option value="Notice Period">Notice Period</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                    <option value="AWOL">AWOL / Absconded</option>
                    <option value="Vacation">Vacation</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Trade / Designation</label>
                  <input type="text" name="trade" value={formData.trade} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Division</label>
                  <input type="text" name="division" value={formData.division} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Site Allocation</label>
                  <input type="text" name="site" value={formData.site} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Date of Joining (DOJ)</label>
                  <input type="date" name="doj" value={formData.doj} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
              </div>
            </div>

            {/* Passport & Visa Details */}
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Passport & Visa Compliance</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Passport Number</label>
                  <input type="text" name="passport_no" value={formData.passport_no} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Passport Expiry</label>
                  <input type="date" name="passport_expiry" value={formData.passport_expiry} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Unified UID</label>
                  <input type="text" name="uid_no" value={formData.uid_no} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Visa Number</label>
                  <input type="text" name="visa_no" value={formData.visa_no} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Visa Expiry</label>
                  <input type="date" name="visa_expiry" value={formData.visa_expiry} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
              </div>
            </div>

            {/* Insurance Details */}
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Health & Work Compensation Insurance</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Insurance Name</label>
                  <input type="text" name="health_insurance_no" value={formData.health_insurance_no} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Ins. Expiry</label>
                  <input type="date" name="health_insurance_expiry" value={formData.health_insurance_expiry} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">WC Ins Name</label>
                  <input type="text" name="accidental_insurance_no" value={formData.accidental_insurance_no} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">WC Ins Expiry</label>
                  <input type="date" name="accidental_insurance_expiry" value={formData.accidental_insurance_expiry} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
              </div>
            </div>

            {/* Salary Breakdown */}
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Salary Structure (WPS)</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Basic (AED)</label>
                  <input type="number" name="basic_salary" value={formData.basic_salary} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white font-bold" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Accommodation</label>
                  <input type="number" name="accommodation_allowance" value={formData.accommodation_allowance} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Transportation</label>
                  <input type="number" name="transport_allowance" value={formData.transport_allowance} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Food Allowance</label>
                  <input type="number" name="food_allowance" value={formData.food_allowance} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Others</label>
                  <input type="number" name="other_allowance" value={formData.other_allowance} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Total Salary</span>
                  <span className="text-base font-black text-blue-900">AED {totalSalary.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {isSaving ? 'Saving...' : '💾 Save / Update Employee Profile'}
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: GRATUITY */}
        {activeTab === 'gratuity' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-800">🇦🇪 MoHRE End-of-Service Gratuity Calculator</h3>
                <p className="text-xs text-slate-400">Compliant with UAE Federal Decree-Law No. 33 of 2021.</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                MoHRE Compliant
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Separation Reason</label>
                <select 
                  value={gratuityReason} 
                  onChange={(e) => setGratuityReason(e.target.value as any)}
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                >
                  <option value="Resignation">Resignation</option>
                  <option value="Termination">Termination</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Last Working Date (LWD)</label>
                <input 
                  type="date" 
                  value={customLWD} 
                  onChange={(e) => setCustomLWD(e.target.value)} 
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs bg-white"
                />
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Estimated Gratuity Payable</span>
                <span className="text-2xl font-black text-emerald-900">AED {gratuityResult.amount.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{gratuityResult.message}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LEAVE & ENCASHMENT */}
        {activeTab === 'leave' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-800">🌴 Unused Leave Encashment Calculator</h3>
              <p className="text-xs text-slate-400">Calculate final leave settlement based on total monthly gross salary.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="text-xs font-semibold text-slate-500">Unused Leave Balance (Days)</label>
                <input 
                  type="number" 
                  min="0"
                  value={unusedLeaveDays} 
                  onChange={(e) => setUnusedLeaveDays(Number(e.target.value))} 
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm font-bold bg-white" 
                  placeholder="e.g. 30"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block">Daily Total Salary Rate</span>
                <span className="text-sm font-bold text-slate-800 mt-2 block">AED {dailyTotalSalary.toFixed(2)} / day</span>
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-purple-700 uppercase">Leave Encashment Payable</span>
                <span className="text-2xl font-black text-purple-900">AED {leaveEncashmentAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REVISIONS */}
        {activeTab === 'revisions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-sm text-slate-800 mb-3">➕ Record New Salary Increment</h3>
              <form onSubmit={handleAddIncrement} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Effective Date</label>
                  <input type="date" value={newIncDate} onChange={(e) => setNewIncDate(e.target.value)} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">New Basic Salary (AED)</label>
                  <input type="number" value={newIncBasic} onChange={(e) => setNewIncBasic(Number(e.target.value))} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs font-bold" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Reason / Remarks</label>
                  <input type="text" value={newIncReason} onChange={(e) => setNewIncReason(e.target.value)} className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs" placeholder="e.g. Annual Promotion" />
                </div>
                <div>
                  <button type="submit" disabled={isSavingInc} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition">
                    {isSavingInc ? 'Logging...' : 'Save Increment'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800">Salary Revision History</h3>
                <span className="text-xs font-bold text-slate-400">{increments.length} Revisions Logged</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="p-4">Effective Date</th>
                      <th className="p-4">Previous Total</th>
                      <th className="p-4">New Total</th>
                      <th className="p-4">Increment Value</th>
                      <th className="p-4">Reason / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {increments.length > 0 ? (
                      increments.map((inc) => (
                        <tr key={inc.id} className="hover:bg-slate-50 transition">
                          <td className="p-4 font-semibold text-slate-700">{inc.effective_date}</td>
                          <td className="p-4 text-slate-500">AED {Number(inc.previous_total).toLocaleString()}</td>
                          <td className="p-4 font-bold text-slate-900">AED {Number(inc.new_total).toLocaleString()}</td>
                          <td className="p-4 font-bold text-emerald-600">+ AED {Number(inc.increment_amount || (inc.new_total - inc.previous_total)).toLocaleString()}</td>
                          <td className="p-4 text-slate-600 italic">{inc.reason || 'Annual Re-evaluation'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                          No salary revisions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOG / CHANGE HISTORY */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-800">🛡️ Profile Update Audit Trail</h3>
                <p className="text-xs text-slate-400">Track all past profile edits, field changes, and user remarks.</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{auditLogs.length} Edits Logged</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Updated By</th>
                    <th className="p-4">Field Changed</th>
                    <th className="p-4">Old Value</th>
                    <th className="p-4">New Value</th>
                    <th className="p-4">Reason / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-semibold text-slate-700">
                          {new Date(log.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 font-bold text-slate-800">{log.updated_by}</td>
                        <td className="p-4 font-mono font-bold text-blue-600 uppercase text-[10px]">{log.field_changed}</td>
                        <td className="p-4 text-slate-400 line-through">{log.old_value}</td>
                        <td className="p-4 font-bold text-emerald-700">{log.new_value}</td>
                        <td className="p-4 text-slate-600 italic">{log.reason}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                        No profile change logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}