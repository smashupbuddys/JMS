/*
  # Quotation Notifications System

  1. New Tables
    - quotation_notifications
      - Stores notifications for quotation status changes
      - Tracks payment reminders and follow-ups
      - Links to customers and staff

  2. Functions
    - create_quotation_notification()
      - Automatically creates notifications on quotation status changes
    - schedule_payment_reminders()
      - Schedules payment reminders based on due dates

  3. Triggers
    - quotation_notification_trigger
      - Fires on quotation status changes
    - payment_reminder_trigger
      - Fires on payment due date changes
*/

-- Create quotation notifications table
CREATE TABLE IF NOT EXISTS quotation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  type varchar NOT NULL CHECK (type IN ('status_change', 'payment_reminder', 'payment_overdue', 'staff_followup')),
  title varchar NOT NULL,
  message text NOT NULL,
  status varchar NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed')),
  action_required boolean DEFAULT false,
  action_type varchar,
  action_data jsonb,
  scheduled_for timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quotation_notifications ENABLE ROW LEVEL SECURITY;

-- Create notification function
CREATE OR REPLACE FUNCTION create_quotation_notification()
RETURNS TRIGGER AS $$
DECLARE
  customer_name text;
  staff_name text;
BEGIN
  -- Get customer and staff names
  SELECT name INTO customer_name FROM customers WHERE id = NEW.customer_id;
  SELECT name INTO staff_name FROM staff WHERE id = NEW.staff_id;

  -- Create notification on status change
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO quotation_notifications (
      quotation_id,
      customer_id,
      staff_id,
      type,
      title,
      message,
      action_required
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      NEW.staff_id,
      'status_change',
      CASE 
        WHEN NEW.status = 'accepted' THEN 'Quotation Accepted'
        WHEN NEW.status = 'rejected' THEN 'Quotation Rejected'
        ELSE 'Quotation Status Updated'
      END,
      CASE 
        WHEN NEW.status = 'accepted' 
          THEN format('Quotation #%s for %s has been accepted', NEW.quotation_number, customer_name)
        WHEN NEW.status = 'rejected' 
          THEN format('Quotation #%s for %s has been rejected', NEW.quotation_number, customer_name)
        ELSE format('Quotation #%s status changed to %s', NEW.quotation_number, NEW.status)
      END,
      NEW.status IN ('accepted', 'rejected')
    );
  END IF;

  -- Create notification for payment status change
  IF TG_OP = 'UPDATE' AND 
     (OLD.payment_details->>'payment_status') != (NEW.payment_details->>'payment_status') THEN
    INSERT INTO quotation_notifications (
      quotation_id,
      customer_id,
      staff_id,
      type,
      title,
      message,
      action_required
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      NEW.staff_id,
      CASE 
        WHEN (NEW.payment_details->>'payment_status') = 'overdue' THEN 'payment_overdue'
        ELSE 'status_change'
      END,
      CASE 
        WHEN (NEW.payment_details->>'payment_status') = 'completed' THEN 'Payment Completed'
        WHEN (NEW.payment_details->>'payment_status') = 'overdue' THEN 'Payment Overdue'
        ELSE 'Payment Status Updated'
      END,
      format('Payment status for quotation #%s is now %s', 
        NEW.quotation_number, 
        NEW.payment_details->>'payment_status'
      ),
      (NEW.payment_details->>'payment_status') = 'overdue'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create payment reminder function
CREATE OR REPLACE FUNCTION schedule_payment_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Schedule reminders if payment is pending
  IF (NEW.payment_details->>'payment_status') = 'pending' AND 
     (NEW.payment_details->>'due_date') IS NOT NULL THEN
    
    -- 3 days before due date
    INSERT INTO quotation_notifications (
      quotation_id,
      customer_id,
      staff_id,
      type,
      title,
      message,
      scheduled_for,
      action_required
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      NEW.staff_id,
      'payment_reminder',
      'Payment Due Soon',
      format('Payment for quotation #%s is due in 3 days', NEW.quotation_number),
      (NEW.payment_details->>'due_date')::timestamptz - interval '3 days',
      true
    );

    -- 1 day before due date
    INSERT INTO quotation_notifications (
      quotation_id,
      customer_id,
      staff_id,
      type,
      title,
      message,
      scheduled_for,
      action_required
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      NEW.staff_id,
      'payment_reminder',
      'Payment Due Tomorrow',
      format('Payment for quotation #%s is due tomorrow', NEW.quotation_number),
      (NEW.payment_details->>'due_date')::timestamptz - interval '1 day',
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER quotation_notification_trigger
  AFTER UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION create_quotation_notification();

CREATE TRIGGER payment_reminder_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION schedule_payment_reminders();

-- Create policies
CREATE POLICY "Staff can view their notifications"
  ON quotation_notifications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = staff_id OR
    auth.uid() IN (
      SELECT id FROM staff 
      WHERE role IN ('admin', 'manager') 
      AND active = true
    )
  );

CREATE POLICY "Staff can update notification status"
  ON quotation_notifications
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = staff_id OR
    auth.uid() IN (
      SELECT id FROM staff 
      WHERE role IN ('admin', 'manager') 
      AND active = true
    )
  )
  WITH CHECK (
    auth.uid() = staff_id OR
    auth.uid() IN (
      SELECT id FROM staff 
      WHERE role IN ('admin', 'manager') 
      AND active = true
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quotation_notifications_staff_id ON quotation_notifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_quotation_notifications_quotation_id ON quotation_notifications(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_notifications_scheduled_for ON quotation_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_quotation_notifications_type ON quotation_notifications(type);
CREATE INDEX IF NOT EXISTS idx_quotation_notifications_status ON quotation_notifications(status);