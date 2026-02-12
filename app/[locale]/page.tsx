'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowRight, Shield, AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const t = useTranslations('login');
  const router = useRouter();
  const { loginWithSSO, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  /**
   * Handle Microsoft Azure AD SSO connection
   */
  const handleAzureLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loginWithSSO();
      // Redirection will be managed by useEffect
    } catch (err) {
      console.error('SSO connection error:', err);
      setError(t('loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/10 rounded-full blur-3xl"></div>
      </div>

      {/* Left Side - Logo Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700"></div>

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center px-16 py-12 text-white w-full">
          {/* Logo Container */}
          <div className="flex items-center justify-center w-full animate-fade-in">
            <div className="relative">
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 bg-white/20 rounded-3xl blur-3xl scale-110"></div>

              {/* Logo */}
              <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-12 shadow-2xl ring-2 ring-white/20">
                <Image
                  src="/logo.png"
                  alt="Shift Manager Logo"
                  width={400}
                  height={400}
                  className="object-contain drop-shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <div className="mt-12 text-center">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              {t('appTitle')}
            </h2>
          </div>

          {/* Decorative line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>

        {/* Animated circles */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-white/5 rounded-full blur-xl animate-pulse delay-700"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
                <Image
                  src="/logo.png"
                  alt="Shift Manager Logo"
                  width={200}
                  height={200}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('appTitle')}</h1>
          </div>

          <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-xl relative overflow-hidden">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>

            <CardHeader className="text-center pb-6 pt-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <LogIn className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-slate-800 mb-3">
                {t('title')}
              </CardTitle>
              <p className="text-slate-600 text-lg">
                {t('subtitle')}
              </p>
            </CardHeader>

            <CardContent className="space-y-6 px-8 pb-8">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              )}

              {/* Azure AD Login Button */}
              <Button
                onClick={handleAzureLogin}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold py-6 h-auto text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t('loggingIn')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3 w-full">
                    <Shield className="w-6 h-6" />
                    <span className="flex-1 text-center">{t('loginWithAzure')}</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </Button>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 font-medium mb-1">
                      {t('secureConnection')}
                    </p>
                    <p className="text-xs text-blue-700">
                      {t('securedBy')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-4 space-y-2">
                <p className="text-xs text-slate-500">
                  {t('copyright')}
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
