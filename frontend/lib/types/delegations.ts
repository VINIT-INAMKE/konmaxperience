export interface ApprovalDelegation {
  id: string;
  from_user_id: string;
  from_user?: { id: string; name: string };
  to_user_id: string;
  to_user?: { id: string; name: string };
  start_date: string;
  end_date: string;
  created_by: string;
  creator?: { id: string; name: string };
  active: boolean;
  created_at: string;
  updated_at: string;
}
