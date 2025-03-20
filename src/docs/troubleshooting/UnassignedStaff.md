# Troubleshooting Guide: Unassigned Staff in Video Call Management

## Quick Checks

✅ **Staff Account Status**
- [ ] Staff member has an active account
- [ ] Staff ID exists in the database
- [ ] Account is not marked as inactive
- [ ] Staff role has video call permissions

✅ **Staff Availability**
- [ ] Staff member has availability marked for the time slot
- [ ] No scheduling conflicts exist
- [ ] Time zone settings are correct
- [ ] Staff is not on leave or vacation

## Common Issues & Solutions

### 1. Staff Assignment Not Saving

**Symptoms:**
- Staff appears unassigned after selection
- Changes don't persist after refresh
- No error messages displayed

**Solutions:**
```sql
-- Check staff record exists
SELECT * FROM staff 
WHERE id = 'staff_id' AND active = true;

-- Verify no scheduling conflicts
SELECT * FROM video_calls 
WHERE staff_id = 'staff_id'
AND scheduled_at BETWEEN 
  'start_time'::timestamptz - interval '30 minutes'
AND 'end_time'::timestamptz + interval '30 minutes';
```

**Resolution Steps:**
1. Clear browser cache and reload
2. Re-select staff member
3. Check browser console for errors
4. Verify database connection

### 2. Permission Issues

**Symptoms:**
- "Unauthorized" errors
- Staff can't be assigned
- Access denied messages

**Solutions:**
```sql
-- Check staff permissions
SELECT s.name, s.role, s.active
FROM staff s
WHERE s.id = 'staff_id';

-- Verify role permissions
SELECT * FROM staff_permissions
WHERE role = 'staff_role'
AND permission = 'manage_video_calls';
```

**Resolution Steps:**
1. Verify staff role is correct
2. Check permission settings
3. Update role if needed
4. Clear permission cache

### 3. Timezone Mismatches

**Symptoms:**
- Incorrect availability shown
- Scheduling conflicts
- Wrong meeting times

**Solutions:**
```sql
-- Check staff timezone settings
SELECT s.name, s.timezone
FROM staff s
WHERE s.id = 'staff_id';

-- Verify video call timezone
SELECT 
  vc.scheduled_at AT TIME ZONE vc.time_zone as local_time,
  vc.scheduled_at AT TIME ZONE s.timezone as staff_time
FROM video_calls vc
JOIN staff s ON s.id = vc.staff_id
WHERE vc.id = 'video_call_id';
```

**Resolution Steps:**
1. Update staff timezone settings
2. Convert all times to UTC
3. Verify customer timezone
4. Check system timezone

### 4. Database Integrity Issues

**Symptoms:**
- Missing staff references
- Broken assignments
- Inconsistent data

**Solutions:**
```sql
-- Fix orphaned assignments
UPDATE video_calls
SET staff_id = NULL
WHERE staff_id NOT IN (
  SELECT id FROM staff WHERE active = true
);

-- Clean up invalid assignments
DELETE FROM workflow_assignments
WHERE staff_id NOT IN (
  SELECT id FROM staff
);
```

**Resolution Steps:**
1. Run database integrity checks
2. Clean up orphaned records
3. Re-establish assignments
4. Verify data consistency

## Preventive Measures

### 1. Staff Management
- Regularly audit staff accounts
- Keep permissions updated
- Monitor staff availability
- Document assignment changes

### 2. System Monitoring
- Check error logs daily
- Monitor failed assignments
- Track system performance
- Set up alerts for issues

### 3. Data Validation
- Validate staff IDs
- Check timezone data
- Verify schedule integrity
- Monitor assignment success rate

## Error Messages & Troubleshooting

| Error Message | Possible Cause | Solution |
|---------------|----------------|----------|
| "Staff not found" | Invalid staff ID or inactive account | Verify staff ID and status |
| "Schedule conflict" | Overlapping appointments | Check staff calendar |
| "Invalid timezone" | Timezone configuration error | Update timezone settings |
| "Permission denied" | Insufficient permissions | Check staff role and permissions |

## Support Escalation

If issues persist after trying these solutions:

1. **Level 1 Support**
   - Basic troubleshooting
   - Permission checks
   - Data verification

2. **Level 2 Support**
   - Database integrity
   - System configuration
   - Complex scheduling issues

3. **Level 3 Support**
   - Data corruption
   - System bugs
   - Critical failures

## Logging & Debugging

Enable detailed logging:

```sql
-- Enable session logging
ALTER DATABASE your_database SET log_statement = 'all';

-- Track staff assignments
CREATE OR REPLACE FUNCTION log_staff_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO staff_assignment_log (
    video_call_id,
    staff_id,
    assigned_at,
    status
  ) VALUES (
    NEW.id,
    NEW.staff_id,
    now(),
    'assigned'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Contact Support

For urgent issues:
- Email: support@jms.com
- Phone: +1-800-SUPPORT
- On-call: Available 24/7

Remember to include:
- Staff ID
- Video Call ID
- Error messages
- Steps to reproduce
- System logs
