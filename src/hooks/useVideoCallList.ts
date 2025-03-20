const fetchCalls = async () => {
  try {
    setError(null);
    const { data, error } = await fetchWithRetry(
      () => supabase
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            email,
            phone,
            type
          )
        `)
        .order('scheduled_at', { ascending: true }),
      {
        maxRetries: 5,
        retryDelay: 1000,
        onRetry: (attempt) => {
          addToast({
            title: 'Connection Issue',
            message: `Retrying to load video calls... (Attempt ${attempt + 1}/5)`,
            type: 'warning'
          });
        }
      }
    );

    if (error) throw error;
    if (!data) throw new Error('No data returned from database');
    
    setCalls(data || []);
  } catch (error) {
    console.error('Error fetching video calls:', error);
    addToast({
      title: 'Connection Error',
      message: 'Failed to load video calls. Please check your internet connection.',
      type: 'error',
      duration: 10000 // Show for 10 seconds
    });
    
    // Return empty array to prevent undefined errors
    setCalls([]);
  } finally {
    setLoading(false);
  }
};

const fetchCustomers = async () => {
  try {
    setError(null);
    setLoading(true);

    const { data, error } = await fetchWithRetry(
      () => 
      supabase
        .from('customers')
        .select('*')
        .order('name'),
      {
        maxRetries: 5,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000), // Exponential backoff
        onRetry: (attempt) => {
          addToast({
            title: 'Connection Issue',
            message: `Retrying to load customers... (Attempt ${attempt + 1}/5)`,
            type: 'warning'
          });
        },
        shouldRetry: (error) => {
          // Retry on network errors or 5xx server errors
          return (
            error.message === 'Failed to fetch' ||
            error.message?.includes('NetworkError') ||
            error.message?.includes('network') ||
            error.status === 503 ||
            error.status === 504
          );
        }
      }
    );

    if (error) throw error;
    if (!data) throw new Error('No data returned from database');

    setCustomers(data || []);
    setError(null);
  } catch (error) {
    console.error('Error fetching customers:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load customers';

    addToast({
      title: 'Connection Error',
      message: `${errorMessage}. Please check your connection and try again.`,
      type: 'error',
      duration: 15000 // Show for 15 seconds
    });
    
    // Set empty array to prevent undefined errors
    setCustomers([]);
    setError('Failed to load customers. Please try refreshing the page.');
  }
};

const handleAddCall = async (callData: any) => {
  try {
    // Validate scheduled time
    const scheduledTime = new Date(callData.scheduledAt);
    const validation = validateFutureTime(scheduledTime);
    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    // Check staff availability
    const endTime = addMinutes(scheduledTime, 30); // 30 minute call duration
    const { data: existingCalls } = await supabase
      .from('video_calls')
      .select('scheduled_at')
      .eq('staff_id', callData.staffId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', scheduledTime.toISOString())
      .lte('scheduled_at', endTime.toISOString());

    if (existingCalls && existingCalls.length > 0) {
      throw new Error('Selected staff member is not available at this time. Please choose a different time slot.');
    }

    const { data, error } = await supabase
      .from('video_calls')
      .insert([{
        ...callData,
        status: 'scheduled'
      }])
      .select();

    if (error) throw error;
    setCalls(prev => [data, ...prev]);
    setShowForm(false);
    addToast({
      title: 'Success',
      message: 'Video call scheduled successfully',
      type: 'success'
    });
  } catch (error) {
    console.error('Error adding video call:', error);
    addToast({
      title: 'Error',
      message: error instanceof Error ? error.message : 'Error scheduling video call. Please try again.',
      type: 'error',
      duration: 5000
    });
  }
};
