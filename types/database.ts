/**
 * Supabase database types.
 *
 * This file has the same shape as the output of:
 *   npx supabase gen types typescript --project-id <your-project-ref> > types/database.ts
 * Regenerate it with that command whenever you change the SQL migration.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          board_id: string;
          created_at: string;
          details: Json;
          id: number;
          user_id: string | null;
        };
        Insert: {
          action: string;
          board_id: string;
          created_at?: string;
          details?: Json;
          id?: never;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          board_id?: string;
          created_at?: string;
          details?: Json;
          id?: never;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      board_ai_usage: {
        Row: {
          board_id: string;
          last_requested_at: string;
        };
        Insert: {
          board_id: string;
          last_requested_at: string;
        };
        Update: {
          board_id?: string;
          last_requested_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_ai_usage_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: true;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      board_members: {
        Row: {
          board_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          board_id: string;
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          board_id?: string;
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "board_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      boards: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          owner_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boards_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cards: {
        Row: {
          board_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          labels: string[];
          list_id: string;
          position: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          board_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          labels?: string[];
          list_id: string;
          position: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          board_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          labels?: string[];
          list_id?: string;
          position?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cards_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          board_id: string;
          created_at: string;
          id: string;
          position: number;
          title: string;
        };
        Insert: {
          board_id: string;
          created_at?: string;
          id?: string;
          position: number;
          title: string;
        };
        Update: {
          board_id?: string;
          created_at?: string;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_edit_board: { Args: { p_board_id: string }; Returns: boolean };
      claim_ai_summary_slot: { Args: { p_board_id: string }; Returns: number };
      get_board_role: { Args: { p_board_id: string }; Returns: string };
      invite_member: {
        Args: { p_board_id: string; p_email: string; p_role: string };
        Returns: {
          board_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
      };
      is_board_member: { Args: { p_board_id: string }; Returns: boolean };
      is_board_owner: { Args: { p_board_id: string }; Returns: boolean };
      rebalance_board_lists: { Args: { p_board_id: string }; Returns: undefined };
      rebalance_list_cards: { Args: { p_list_id: string }; Returns: undefined };
      shares_board_with: { Args: { p_user_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

/** Shorthand: Tables<"cards"> is the row type of the cards table. */
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
