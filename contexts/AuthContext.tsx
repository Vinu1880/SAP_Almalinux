'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  PublicClientApplication,
  AccountInfo,
} from '@azure/msal-browser';
import { loginRequest, tokenRequest } from '@/lib/msalConfig';
import { getMsalInstance } from '@/lib/msalInstance';

interface AuthContextType {
  msalInstance: PublicClientApplication | null;
  account: AccountInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithSSO: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialisation MSAL + traitement du retour OAuth
   */
  useEffect(() => {
    const init = async () => {
      try {
        const instance = getMsalInstance();
        await instance.initialize();

        try {
          const result = await instance.handleRedirectPromise();

          if (result?.account) {
            setAccount(result.account);
            setIsAuthenticated(true);

            if (result.accessToken) {
              sessionStorage.setItem('msalAccessToken', result.accessToken);
            }
          }
        } catch (e: any) {
          // ✅ Erreur normale si aucun redirect n’a eu lieu
          if (e.errorCode !== 'no_token_request_cache_error') {
            console.error('MSAL redirect error:', e);
          }
        }

        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsAuthenticated(true);
        }

        setMsalInstance(instance);
      } catch (err) {
        console.error('Erreur lors de l\'initialisation de MSAL:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  /**
   * Connexion SSO Azure AD (Redirect)
   */
  const loginWithSSO = async () => {
    if (!msalInstance) {
      console.warn('MSAL pas encore prêt');
      return;
    }

    setIsLoading(true);
    await msalInstance.loginRedirect(loginRequest);
  };

  /**
   * TEMPORAIRE - Connexion email/password
   */
  const loginWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const tempAccount: AccountInfo = {
        homeAccountId: 'temp-' + Date.now(),
        environment: 'local',
        tenantId: 'local',
        username: email,
        localAccountId: 'temp-' + Date.now(),
        name: email.split('@')[0],
      };

      setAccount(tempAccount);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Déconnexion
   */
  const logout = async () => {
    try {
      setIsLoading(true);

      if (msalInstance && account?.homeAccountId.startsWith('temp-')) {
        setAccount(null);
        setIsAuthenticated(false);
      } else if (msalInstance && account) {
        await msalInstance.logoutPopup({ account });
        setAccount(null);
        setIsAuthenticated(false);
      }

      sessionStorage.removeItem('msalAccessToken');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Récupération du token Graph API
   */
  const getAccessToken = async (): Promise<string | null> => {
    if (!msalInstance || !account) {
      return null;
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...tokenRequest,
        account,
      });
      return response.accessToken;
    } catch {
      const response = await msalInstance.acquireTokenPopup(tokenRequest);
      return response.accessToken;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        msalInstance,
        account,
        isAuthenticated,
        isLoading,
        loginWithSSO,
        loginWithEmail,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
