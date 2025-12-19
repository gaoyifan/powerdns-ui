export interface Zone {
  id: string;
  name: string;
  type: string;
  url: string;
  kind: 'Native' | 'Master' | 'Slave';
  serial?: number;
  notified_serial?: number;
  masters?: string[];
  dnssec?: boolean;
  nsec3param?: string;
  nsec3narrow?: boolean;
  presigned?: boolean;
  soa_edit?: string;
  soa_edit_api?: string;
  api_rectify?: boolean;
  zone?: string; // Format: zone_name..view_name
  account?: string;
  nameservers?: string[];
  master_tsig_key_ids?: string[];
  slave_tsig_key_ids?: string[];
}

export interface RRSet {
  name: string;
  type: string;
  ttl: number;
  changetype?: 'REPLACE' | 'DELETE';
  records: {
    content: string;
    disabled: boolean;
  }[];
  comments?: {
    content: string;
    account: string;
    modified_at: number;
  }[];
}

export interface View {
  name: string;
  zones?: string[]; // List of zone IDs
}

export interface Network {
  network: string; // CIDR
  view?: string;
}

export interface Server {
  id: string;
  type: string;
  version: string;
  daemon_type: string;
  url: string;
  zones_url: string;
  config_url: string;
}

export interface StatisticItem {
  name: string;
  type: 'StatisticItem';
  value: string;
}
