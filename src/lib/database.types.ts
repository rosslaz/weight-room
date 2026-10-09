// Generated from the Supabase schema (Workout Tracker project), trimmed to what the app uses.
export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      exercises: {
        Row: { archived: boolean; created_at: string; id: string; name: string; notes: string | null }
        Insert: { archived?: boolean; created_at?: string; id?: string; name: string; notes?: string | null }
        Update: { archived?: boolean; created_at?: string; id?: string; name?: string; notes?: string | null }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_admin: boolean
          unit: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string
          id: string
          is_admin?: boolean
          unit?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_admin?: boolean
          unit?: string
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          exercise_id: string
          id: string
          reps: number | null
          set_number: number
          updated_at: string
          user_id: string
          weight: number | null
          workout_date: string
          workout_exercise_id: string | null
        }
        Insert: {
          exercise_id: string
          id?: string
          reps?: number | null
          set_number: number
          updated_at?: string
          user_id?: string
          weight?: number | null
          workout_date: string
          workout_exercise_id?: string | null
        }
        Update: {
          exercise_id?: string
          id?: string
          reps?: number | null
          set_number?: number
          updated_at?: string
          user_id?: string
          weight?: number | null
          workout_date?: string
          workout_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'set_logs_workout_exercise_id_fkey'
            columns: ['workout_exercise_id']
            isOneToOne: false
            referencedRelation: 'workout_exercises'
            referencedColumns: ['id']
          },
        ]
      }
      workout_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          position: number
          target_reps: string | null
          target_sets: number
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          position?: number
          target_reps?: string | null
          target_sets?: number
          workout_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          target_reps?: string | null
          target_sets?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workout_exercises_workout_id_fkey'
            columns: ['workout_id']
            isOneToOne: false
            referencedRelation: 'workouts'
            referencedColumns: ['id']
          },
        ]
      }
      workouts: {
        Row: { created_at: string; id: string; notes: string | null; scheduled_date: string; title: string }
        Insert: { created_at?: string; id?: string; notes?: string | null; scheduled_date: string; title?: string }
        Update: { created_at?: string; id?: string; notes?: string | null; scheduled_date?: string; title?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      previous_sets: {
        Args: { p_before: string; p_exercise_ids: string[] }
        Returns: {
          exercise_id: string
          reps: number | null
          set_number: number
          weight: number | null
          workout_date: string
        }[]
      }
      my_exercise_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          exercise_id: string
          name: string
          sessions: number
          last_date: string
          best_weight: number | null
          last_top_weight: number | null
        }[]
      }
      set_admin: {
        Args: { p_is_admin: boolean; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicTables = Database['public']['Tables']
export type Row<T extends keyof PublicTables> = PublicTables[T]['Row']
