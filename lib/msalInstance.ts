import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

let instance: PublicClientApplication | null = null;

export const getMsalInstance = () => {
  if (!instance) {
    instance = new PublicClientApplication(msalConfig);
  }
  return instance;
};
