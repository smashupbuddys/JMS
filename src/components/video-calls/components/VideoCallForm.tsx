@@ .. @@
       await onSubmit({
         ...formData,
         customerTimeZone,
         customerCountry,
         scheduledAt: scheduledTime.toISOString(),
         time_zone: getLocalTimeZone(),
         customer_time_zone: customerTimeZone,
         customer_country: customerCountry,
+        staff: availableStaff.find(s => s.id === formData.staffId),
         assigned_staff: {
           primary: formData.staffId,
          staff_name: availableStaff.find(s => s.id === formData.staffId)?.name || 'Staff Member',
+          staff_name: availableStaff.find(s => s.id === formData.staffId)?.name,
           backup: null,
           history: [{
             staff_id: formData.staffId,
            name: availableStaff.find(s => s.id === formData.staffId)?.name || 'Staff Member',
+            name: availableStaff.find(s => s.id === formData.staffId)?.name,
             assigned_at: new Date().toISOString(),
             assigned_by: 'system'
           }]
         }
       });
