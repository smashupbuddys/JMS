export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: string;
          full_name: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: string;
          full_name?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          full_name?: string | null;
          is_active?: boolean;
        };
      };
      staff: {
        Row: {
          id: string;
          employee_id: string;
          department: string;
          position: string;
          permissions: Record<string, boolean>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          department: string;
          position: string;
          permissions?: Record<string, boolean>;
        };
        Update: {
          id?: string;
          employee_id?: string;
          department?: string;
          position?: string;
          permissions?: Record<string, boolean>;
        };
      };
    };
  };
}; 