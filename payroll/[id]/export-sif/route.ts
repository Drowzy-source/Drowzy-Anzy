import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  
  // 1. Fetch the Payroll Run
  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (runError || !run) return new NextResponse('Payroll not found', { status: 404 })
  if (run.status !== 'Approved' && run.status !== 'Paid') {
    return new NextResponse('Only Approved payrolls can be exported to SIF', { status: 400 })
  }

  // 2. Fetch the Payslips with Employee Banking Details
  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      *,
      employees ( 
        badge_number,
        employee_banking ( labour_id, bank_routing_code, account_iban )
      )
    `)
    .eq('payroll_run_id', run.id)

  if (!payslips || payslips.length === 0) return new NextResponse('No payslips found', { status: 404 })

  // 3. Setup SIF Formatting Variables
  const now = new Date()
  const creationDate = now.toISOString().split('T')[0] // YYYY-MM-DD
  const creationTime = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '') // HHMM
  const salaryMonth = `${String(run.month).padStart(2, '0')}${run.year}` // MMYYYY
  
  const totalAmount = payslips.reduce((sum, p) => sum + Number(p.net_pay), 0)
  const totalRecords = payslips.length

  const estId = process.env.WPS_ESTABLISHMENT_ID || '0000000000000'
  const companyBankCode = process.env.WPS_COMPANY_BANK_ROUTING || '000000000'

  // 4. Construct Header Row
  // Format: Est ID, Bank Code, Date, Time, Month, Total Records, Total Amount, Currency, Remarks
  const headerRow = `${estId},${companyBankCode},${creationDate},${creationTime},${salaryMonth},${totalRecords},${totalAmount.toFixed(2)},AED,SALARY`

  // 5. Construct Employee Rows
  const employeeRows = payslips.map((slip) => {
    // Safely access the banking array (Supabase might return an array for 1-to-1 relationships depending on schema setup)
    const bankingArray = slip.employees?.employee_banking
    const banking = Array.isArray(bankingArray) ? bankingArray[0] : (bankingArray || {})
    
    // WPS expects Fixed Pay and Variable Pay separated
    const fixedPay = Number(slip.base_salary) + Number(slip.allowances_total)
    // Variable Pay = Overtime + Increments - Deductions (Ensure it doesn't go below 0 for WPS)
    const rawVariable = Number(slip.overtime_pay) + Number(slip.active_increments_total) - Number(slip.deductions)
    const variablePay = Math.max(0, rawVariable)

    // UAE month calculation for exact start/end dates
    const startDate = new Date(run.year, run.month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(run.year, run.month, 0).toISOString().split('T')[0]

    // Format: Labour ID, Bank Routing, IBAN, Start Date, End Date, Days Worked, Fixed Pay, Variable Pay, Unpaid Leave Days
    return `${banking.labour_id || ''},${banking.bank_routing_code || ''},${banking.account_iban || ''},${startDate},${endDate},${slip.days_worked},${fixedPay.toFixed(2)},${variablePay.toFixed(2)},${slip.unpaid_absences}`
  })

  // 6. Combine and Return as File Download
  const sifContent = [headerRow, ...employeeRows].join('\n')

  return new NextResponse(sifContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${estId}_${creationDate.replace(/-/g, '')}${creationTime}.sif"`,
      'Cache-Control': 'no-cache'
    },
  })
}