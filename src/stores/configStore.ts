import { config, type AllConfigs } from '../config';

// Read-only accessor for validated config
export const getConfig = (): AllConfigs => config;
