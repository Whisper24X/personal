export interface PostgresConnectionConfig {
  host: string;
  port: number;
  adminUser: string;
  sourceDatabase: string;
}

export interface DatabaseIsolationConfig {
  enabled: boolean;
  postgres: PostgresConnectionConfig;
  envVar: string;
  dataImport?: {
    tables: string[];
  };
}

export interface TableInfo {
  name: string;
  estimatedRows: number;
  sizeBytes: number;
}
