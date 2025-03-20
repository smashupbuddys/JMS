import { supabase } from '../lib/supabase';

export async function addPaymentNote(
  quotationId: string,
  note: string,
  status: string,
  nextPaymentDate: string | null,
  staffId: string
) {
  try {
    const noteData = {
      timestamp: new Date().toISOString(),
      note,
      status,
      staff_id: staffId,
      next_payment_date: nextPaymentDate
    };

    const { data, error } = await supabase
      .from('quotations')
      .update({
        payment_notes: supabase.sql`array_append(payment_notes, ${noteData}::jsonb)`,
        next_follow_up: nextPaymentDate ? {
          date: nextPaymentDate,
          reason: note,
          status,
          set_by: staffId,
          set_at: new Date().toISOString()
        } : null
      })
      .eq('id', quotationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding payment note:', error);
    throw error;
  }
}

export function getPaymentStatus(
  billGeneratedAt: string | null,
  billStatus: string,
  nextFollowUp: any
) {
  if (!billGeneratedAt) return 'Not Generated';
  if (billStatus === 'paid') return 'Paid';
  
  const now = new Date();
  const billDate = new Date(billGeneratedAt);
  const daysSinceBill = Math.floor((now.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));

  if (nextFollowUp?.date) {
    const followUpDate = new Date(nextFollowUp.date);
    if (followUpDate > now) {
      return 'Pending (Follow-up Scheduled)';
    }
  }

  if (daysSinceBill >= 10) return 'Severely Overdue';
  if (daysSinceBill >= 7) return 'Suspicious';
  if (daysSinceBill >= 3) return 'Overdue';
  return 'Pending';
}
