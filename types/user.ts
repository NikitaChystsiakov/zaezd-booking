export interface UserInfo {
    user: {
      id: bigint | number;
      first_name: string | null;
      last_name: string | null;
      second_name: string | null;
      email: string;
      phone: string | null;  
    };
  }

  export interface UserInfoForAdmin {
    id: number | string
    email: string
    first_name: string | null
    second_name: string | null
    last_name: string | null
    phone: string | null
    role: string
    active: boolean
    created_at: string
  }